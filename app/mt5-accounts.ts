"use client";

import { useEffect, useRef, useState } from "react";
import { createLocalStore } from "./local-store";
import { MAX_MT5_SNAPSHOT, mt5AccountKey, readMt5Snapshot, type Mt5Snapshot } from "./mt5-snapshot";

const snapshotUrl = "http://127.0.0.1:8765/api/mt5/snapshot";
const storeName = "snapshots";
const pollMs = 15000;
const demoKey = "demo";
const accountChoice = createLocalStore("bluespherix.mt5.active.v1", "", value => {
  if (typeof value !== "string" || value.length > 250) throw Error("Conto selezionato non valido.");
  return value;
});

function openArchive(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("bluespherix-mt5", 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      request.onsuccess = () => request.result.close();
      reject(Error("Archivio MT5 in uso da un’altra scheda."));
    };
  });
}

async function archive<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
  const db = await openArchive();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      let result: T;
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(transaction.error);
      run(transaction.objectStore(storeName), value => { result = value; });
    });
  } finally {
    db.close();
  }
}

const loadAccounts = () => archive<Mt5Snapshot[]>("readonly", (store, done) => {
  const request = store.getAll();
  request.onsuccess = () => done(request.result);
});

function keepLatest(snapshot: Mt5Snapshot, signal?: AbortSignal) {
  const id = mt5AccountKey(snapshot);
  return archive<Mt5Snapshot>("readwrite", (store, done) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const previous: Mt5Snapshot | undefined = request.result;
      if (signal?.aborted) return;
      if (previous && Date.parse(previous.capturedAt) >= Date.parse(snapshot.capturedAt)) {
        done(previous);
      } else {
        store.put(snapshot, id);
        done(snapshot);
      }
    };
  });
}

async function readFile(file: File) {
  if (file.size > MAX_MT5_SNAPSHOT) throw Error("Il file supera 12 MB.");
  return readMt5Snapshot(await file.text());
}

async function readResponse(response: Response) {
  if (!response.body || Number(response.headers.get("Content-Length")) > MAX_MT5_SNAPSHOT) throw Error("Snapshot MT5 non disponibile o troppo grande.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let length = 0;
  let text = "";
  try {
    let chunk = await reader.read();
    while (!chunk.done) {
      length += chunk.value.byteLength;
      if (length > MAX_MT5_SNAPSHOT) throw Error("Lo snapshot supera 12 MB.");
      text += decoder.decode(chunk.value, { stream: true });
      chunk = await reader.read();
    }
    return readMt5Snapshot(text + decoder.decode());
  } finally {
    await reader.cancel();
  }
}

type Source = { type: "bridge"; token: string } | { type: "file"; handle: FileSystemFileHandle };
type FilePicker = (options: { types: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileSystemFileHandle[]>;
type Sync = { state: "off" | "connecting" | "live" | "error"; account: string; message: string };
const off: Sync = { state: "off", account: "", message: "" };

export function useMt5Accounts() {
  const [accounts, setAccounts] = useState<Mt5Snapshot[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const [localChoice, setLocalChoice] = useState<string | null>(null);
  const [sync, setSync] = useState<Sync>(off);
  const [session, setSession] = useState<{ source: Source; controller: AbortController } | null>(null);
  const activeController = useRef<AbortController | null>(null);
  const { value: activeKey, error: selectionError } = accountChoice.useStore();
  const active = accounts.find(account => mt5AccountKey(account) === (localChoice ?? activeKey)) ?? null;

  useEffect(() => {
    let active = true;
    void loadAccounts().then(items => {
      if (active) setAccounts(items);
    }, () => {
      if (active) setArchiveError("Archivio del browser non disponibile. I dati resteranno in questa scheda.");
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, []);

  function select(id: string) {
    const choice = id || demoKey;
    setLocalChoice(accountChoice.save(() => choice) ? null : choice);
  }

  async function save(snapshot: Mt5Snapshot, signal?: AbortSignal) {
    let latest = snapshot;
    try {
      latest = await keepLatest(snapshot, signal);
    } catch {
      if (!signal?.aborted) setArchiveError("Salvataggio nel browser non riuscito. I dati aggiornati restano in questa scheda.");
    }
    if (signal?.aborted) return;
    const key = mt5AccountKey(snapshot);
    setAccounts(current => {
      const previous = current.find(account => mt5AccountKey(account) === key);
      if (previous && Date.parse(previous.capturedAt) >= Date.parse(latest.capturedAt)) return current;
      return [...current.filter(account => mt5AccountKey(account) !== key), latest];
    });
  }

  useEffect(() => {
    if (!session) return;
    const { source, controller } = session;
    const cancellation = new AbortController();
    const signal = AbortSignal.any([cancellation.signal, controller.signal]);
    let inFlight = false;
    let expectedAccount = "";
    let revision = "";
    async function refresh() {
      if (inFlight || signal.aborted || document.hidden) return;
      inFlight = true;
      try {
        let next: Mt5Snapshot | null = null;
        let nextRevision = revision;
        if (source.type === "bridge") {
          const response = await fetch(snapshotUrl, {
            headers: { Authorization: `Bearer ${source.token}`, ...(revision && { "If-None-Match": revision }) },
            cache: "no-store", credentials: "omit", redirect: "error",
            signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
          });
          if (response.status === 401) {
            controller.abort();
            setSession(current => current === session ? null : current);
            setSync({ state: "error", account: expectedAccount, message: "Codice del connettore scaduto o errato. Inserisci il codice mostrato dal terminale." });
            return;
          }
          if (response.status !== 304) {
            if (!response.ok) throw Error("Connettore attivo, ma MT5 non risponde. Controlla il terminale.");
            next = await readResponse(response);
            if (next.version !== 2) throw Error("Aggiorna il connettore BlueSpherix a questa versione.");
            nextRevision = response.headers.get("ETag") ?? "";
          }
        } else {
          const file = await source.handle.getFile();
          nextRevision = `${file.lastModified}:${file.size}`;
          if (nextRevision !== revision) next = await readFile(file);
        }
        if (signal.aborted) return;
        if (next) {
          const id = mt5AccountKey(next);
          if (expectedAccount && expectedAccount !== id) throw Error("La sorgente ora contiene un conto diverso. Ricollegala per aggiungerlo.");
          await save(next, signal);
          if (signal.aborted) return;
          if (!expectedAccount) {
            // Keep the current account selection if the user has already chosen one.
            if (!accountChoice.save(current => current || id)) setLocalChoice(current => current ?? id);
          }
          expectedAccount = id;
          revision = nextRevision;
        }
        setSync(current => current.state === "live" && current.account === expectedAccount ? current : {
          state: "live", account: expectedAccount, message: "",
        });
      } catch (error) {
        if (!signal.aborted) {
          const message = error instanceof Error && error.name === "Error" ? error.message
            : source.type === "bridge" ? "Connettore locale irraggiungibile. Controlla che sia avviato e che il browser consenta l’accesso locale."
              : "File locale irraggiungibile. Controlla l’accesso o carica un nuovo snapshot.";
          setSync(current => current.state === "error" && current.message === message ? current : { state: "error", account: expectedAccount, message });
        }
      } finally {
        inFlight = false;
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, pollMs);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      cancellation.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [session]);

  function start(source: Source) {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    setError("");
    setSync({ ...off, state: "connecting" });
    setSession({ source, controller });
  }

  function disconnect() {
    activeController.current?.abort();
    activeController.current = null;
    setSession(null);
    setSync(off);
  }

  async function importFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const snapshot = await readFile(file);
      await save(snapshot);
      select(mt5AccountKey(snapshot));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Impossibile leggere lo snapshot.");
    } finally {
      setBusy(false);
    }
  }

  async function followFile() {
    const browser = window as Window & { showOpenFilePicker?: FilePicker };
    if (!browser.showOpenFilePicker) {
      setError("Questo browser può caricare snapshot ma non seguire un file. Usa il connettore per gli aggiornamenti automatici.");
      return;
    }
    setBusy(true);
    try {
      const [handle] = await browser.showOpenFilePicker({ types: [{ description: "Snapshot MT5", accept: { "application/json": [".json"] } }] });
      if (handle) start({ type: "file", handle });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setError("Accesso al file non disponibile.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    disconnect();
    setBusy(true);
    setError("");
    try {
      await archive<void>("readwrite", (store, done) => {
        store.delete(id);
        done();
      });
    } catch {
      setError("Impossibile cancellare il conto dall’archivio del browser.");
      return;
    } finally {
      setBusy(false);
    }
    setAccounts(current => current.filter(account => mt5AccountKey(account) !== id));
    setLocalChoice(current => current === id ? null : current);
    accountChoice.save(current => current === id ? demoKey : current);
  }

  return {
    accounts, active, ready, busy, sync, error: error || archiveError || selectionError,
    select, remove, disconnect, importFile, followFile,
    connect: (token: string) => start({ type: "bridge", token }),
  };
}

export type Mt5Accounts = ReturnType<typeof useMt5Accounts>;
