const SESSION_LIFETIME = "ctrlx:session-lifetime";
const SESSION_UNAUTHORIZED = "ctrlx:session-unauthorized";
const SESSION_SIGNED_OUT = "ctrlx:session-signed-out";
const SESSION_CHANNEL = "ctrlx:session";

type SessionEndReason = "expired" | "signed-out";

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

export function reportSignedOut() {
  window.dispatchEvent(new Event(SESSION_SIGNED_OUT));
}

export function watchSession(onSessionEnd: (reason: SessionEndReason) => void) {
  const channel = typeof window.BroadcastChannel === "function"
    ? new window.BroadcastChannel(SESSION_CHANNEL)
    : undefined;
  let deadline: number | undefined;
  let timer: number | undefined;
  let expired = false;

  function endSession(reason: SessionEndReason) {
    const hadSession = deadline !== undefined;
    window.clearTimeout(timer);
    deadline = undefined;
    const privatePage = /^\/(patient|professional)(\/|$)/.test(window.location.pathname);
    if (expired || (!hadSession && !privatePage)) return;
    expired = true;
    onSessionEnd(reason);
  }

  function expire() {
    endSession("expired");
  }

  function broadcastSignOut() {
    channel?.postMessage("signed-out");
  }

  function receiveSessionMessage(event: MessageEvent) {
    if (event.data === "signed-out") endSession("signed-out");
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
  window.addEventListener(SESSION_SIGNED_OUT, broadcastSignOut);
  channel?.addEventListener("message", receiveSessionMessage);
  window.addEventListener("focus", checkDeadline);
  window.addEventListener("pageshow", checkDeadline);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener(SESSION_LIFETIME, updateDeadline);
    window.removeEventListener(SESSION_UNAUTHORIZED, expire);
    window.removeEventListener(SESSION_SIGNED_OUT, broadcastSignOut);
    channel?.close();
    window.removeEventListener("focus", checkDeadline);
    window.removeEventListener("pageshow", checkDeadline);
  };
}
