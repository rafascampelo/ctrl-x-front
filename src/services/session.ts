const SESSION_LIFETIME = "ctrlx:session-lifetime";
const SESSION_UNAUTHORIZED = "ctrlx:session-unauthorized";

export function reportSessionLifetime(header: string | null) {
  if (typeof window === "undefined" || header === null || !/^\d+$/.test(header)) return;
  const seconds = Number(header);
  if (Number.isSafeInteger(seconds) && seconds <= 2_147_483) {
    window.dispatchEvent(new CustomEvent(SESSION_LIFETIME, { detail: seconds }));
  }
}

export function reportUnauthorized() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_UNAUTHORIZED));
  }
}

export function watchSession(onExpired: () => void) {
  let deadline: number | undefined;
  let timer: number | undefined;
  let expired = false;

  function expire() {
    const hadSession = deadline !== undefined;
    window.clearTimeout(timer);
    deadline = undefined;
    const privatePage = /^\/(patient|professional)(\/|$)/.test(window.location.pathname);
    if (expired || (!hadSession && !privatePage)) return;
    expired = true;
    onExpired();
  }

  function checkDeadline() {
    window.clearTimeout(timer);
    if (deadline === undefined) return;
    const remaining = deadline - Date.now();
    if (remaining <= 0) expire();
    else timer = window.setTimeout(checkDeadline, remaining);
  }

  function updateDeadline(event: Event) {
    if (expired) return;
    const seconds: number = (event as CustomEvent<number>).detail;
    deadline = Date.now() + seconds * 1000;
    checkDeadline();
  }

  window.addEventListener(SESSION_LIFETIME, updateDeadline);
  window.addEventListener(SESSION_UNAUTHORIZED, expire);
  window.addEventListener("focus", checkDeadline);
  window.addEventListener("pageshow", checkDeadline);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener(SESSION_LIFETIME, updateDeadline);
    window.removeEventListener(SESSION_UNAUTHORIZED, expire);
    window.removeEventListener("focus", checkDeadline);
    window.removeEventListener("pageshow", checkDeadline);
  };
}
