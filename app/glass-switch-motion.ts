// Shared optical motion; no DOM changes or per-frame layout reads for selectors.
export const SWITCH_TRAVEL_MS = 300;
export const SWITCH_SETTLE_MS = 360;
export const SWITCH_MOTION_MS = SWITCH_TRAVEL_MS + SWITCH_SETTLE_MS;
export type SwitchTravel = { x: number; y: number; width: number; height: number };
type Rect = { left: number; top: number; width: number; height: number };
const smooth = (n: number) => { n = Math.max(0, Math.min(1, n)); return n * n * (3 - 2 * n); };

export function switchRecoil(elapsed: number) {
  const phase = (elapsed - SWITCH_TRAVEL_MS) / SWITCH_SETTLE_MS;
  if (phase <= 0 || phase >= 1) return 0;
  return Math.sin(phase * Math.PI * 3) * Math.exp(-phase * 4)
    * smooth(phase / .12) * (1 - smooth((phase - .75) / .25));
}

export function switchRect(rect: Rect, travel: SwitchTravel, elapsed: number) {
  const progress = smooth(elapsed / SWITCH_TRAVEL_MS);
  const distance = Math.hypot(travel.x, travel.y);
  const horizontal = Math.abs(travel.x) >= Math.abs(travel.y);
  const pulse = Math.sin(Math.PI * Math.max(0, Math.min(1, elapsed / SWITCH_TRAVEL_MS))) ** 2;
  const recoil = switchRecoil(elapsed);
  let width = travel.width + (rect.width - travel.width) * progress;
  let height = travel.height + (rect.height - travel.height) * progress;
  if (horizontal) width += Math.min(distance * .45, rect.width * .6) * pulse;
  else height += Math.min(distance * .45, rect.height * .6) * pulse;
  width *= 1 - .10 * recoil;
  height *= 1 + .065 * recoil;
  const centerX = rect.left + rect.width * .5 + (travel.x + (travel.width - rect.width) * .5) * (1 - progress);
  const centerY = rect.top + rect.height * .5 + (travel.y + (travel.height - rect.height) * .5) * (1 - progress);
  return { left: centerX - width * .5, top: centerY - height * .5, width, height,
    right: centerX + width * .5, bottom: centerY + height * .5 };
}

export function thumbKeyframes(from: number, to: number, scaleX = 1, scaleY = 1): Keyframe[] {
  return [
    { transform: `translateX(${from}px) scale(${scaleX},${scaleY})`, offset: 0, easing: 'ease-out' },
    { transform: `translateX(${from + (to - from) * .35}px) scale(1.32,.92)`, offset: .22, easing: 'cubic-bezier(.2,.7,.3,1)' },
    { transform: `translateX(${to}px) scale(.94,1.055)`, offset: .56, easing: 'ease-in-out' },
    { transform: `translateX(${to}px) scale(1.025,.98)`, offset: .75, easing: 'ease-in-out' },
    { transform: `translateX(${to}px) scale(.995,1.004)`, offset: .90, easing: 'ease-out' },
    { transform: `translateX(${to}px) scale(1,1)`, offset: 1 },
  ];
}
