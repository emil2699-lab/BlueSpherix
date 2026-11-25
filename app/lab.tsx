import BacktestArchive from "./backtest-archive";

export default function Lab() {
  return <div className="lab-view">
    <section className="welcome">
      <div><p className="date-line">Strategy Tester</p><h1>Lab.</h1><p>Importa e confronta i report delle tue strategie.</p></div>
    </section>
    <BacktestArchive />
  </div>;
}
