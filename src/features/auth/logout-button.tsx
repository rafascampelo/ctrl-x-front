"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { logout } from "./auth";
import { reportSignedOut } from "@/services/session";

export function LogoutButton() {
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

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
    <div>
      <Button type="button" variant="secondary" disabled={pending} onClick={() => void signOut()}>
        {pending ? "Saindo…" : "Sair da conta"}
      </Button>
      {failed && <p role="alert">Não foi possível sair da conta. Confira sua conexão e tente novamente.</p>}
    </div>
  );
}
