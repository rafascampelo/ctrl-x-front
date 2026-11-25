"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { logout } from "./auth";
import { reportSignedOut } from "@/services/session";
import styles from "./logout-button.module.css";

export function LogoutButton() {
  const client = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (confirmationOpen && !dialog.open) dialog.showModal();
    if (!confirmationOpen && dialog.open) dialog.close();
  }, [confirmationOpen]);

  async function signOut() {
    setPending(true);
    setFailed(false);
    try {
      await logout();
      reportSignedOut();
      await client.cancelQueries();
      client.clear();
      // A full navigation also discards drafts and in-memory component state.
      window.location.replace("/login");
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className={styles.iconButton}
        aria-label="Sair da conta"
        aria-haspopup="dialog"
        title="Sair da conta"
        onClick={() => {
          setFailed(false);
          setConfirmationOpen(true);
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
        </svg>
      </Button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby="logout-title"
        aria-describedby="logout-description"
        onClose={() => setConfirmationOpen(false)}
        onCancel={() => setConfirmationOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            setConfirmationOpen(false);
          }
        }}
      >
        <div className={styles.dialogMark} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
            <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
          </svg>
        </div>
        <h2 id="logout-title">Quer sair da sua conta?</h2>
        <p id="logout-description">
          Você será desconectado do Ctrl X neste dispositivo. Poderá entrar
          novamente quando quiser.
        </p>
        {failed && (
          <p className={styles.error} role="alert">
            Não foi possível sair da conta. Confira sua conexão e tente novamente.
          </p>
        )}
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.cancelButton}
            autoFocus
            disabled={pending}
            onClick={() => setConfirmationOpen(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            disabled={pending}
            onClick={() => void signOut()}
          >
            {pending ? "Saindo…" : "Sair da conta"}
          </button>
        </div>
      </dialog>
    </>
  );
}
