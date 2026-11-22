"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/services/api-client";
import { healthSchema } from "@/types/health";
import { getApiHealthUrl } from "./api-health-url";
import { Button } from "@/components/ui/button";
import styles from "./api-health.module.css";

export function ApiHealth() {
  const { isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["system", "health"],
    queryFn: ({ signal }) =>
      fetchJson(getApiHealthUrl(), healthSchema, { signal }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const state = isPending ? "checking" : isError ? "error" : "connected";
  const message = isPending
    ? "Verificando conexão…"
    : isError
      ? "Não foi possível conectar ao serviço. Tente novamente em instantes."
      : "Conectado à API.";

  return (
    <div className={styles.status} data-state={state}>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <Button
        variant="secondary"
        type="button"
        disabled={isFetching}
        onClick={() => void refetch()}
      >
        {isFetching ? "Verificando…" : "Verificar novamente"}
      </Button>
    </div>
  );
}