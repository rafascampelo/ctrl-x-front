import Link from "next/link";
import { ApiError } from "@/services/api-client";
import { AuthError } from "@/features/auth/auth";
import { Button } from "@/components/ui/button";
import { ContentState } from "@/components/ui/content-state";
import styles from "./care.module.css";

export function isExpired(error: unknown) {
  return (
    (error instanceof ApiError || error instanceof AuthError) &&
    error.status === 401
  );
}

export function errorMessage(error: unknown) {
  if (isExpired(error))
    return "Sua sessão expirou. Entre novamente para continuar.";
  if (error instanceof ApiError || error instanceof AuthError) {
    switch (error.status) {
      case 403:
        return "Acesso não autorizado para esta conta.";
      case 404:
        return "Recurso indisponível ou sem permissão de acesso. Confira os dados e tente novamente.";
      case 409:
        return "Os dados ou o vínculo mudaram ou já estão em uso. Atualize a página antes de tentar novamente.";
      case 422:
        return "Confira os campos informados. A API não aceitou os dados enviados.";
    }
  }
  return "Não foi possível comunicar com o serviço. Seus dados preenchidos foram preservados. Tente novamente.";
}

export function Feedback({
  error,
  message,
}: {
  error?: unknown;
  message?: string;
}) {
  if (error)
    return (
      <div className={`${styles.feedback} ${styles.error}`} role="alert">
        <p>{errorMessage(error)}</p>
        {error instanceof ApiError && error.detail && (
          <p>Mensagem do serviço: {error.detail}</p>
        )}
        {isExpired(error) && (
          <Link href="/login?expired=1">Entrar novamente</Link>
        )}
      </div>
    );
  if (message)
    return (
      <p className={styles.feedback} role="status">
        {message}
      </p>
    );
  return null;
}

export function CareLoading({
  title = "Carregando seus dados",
}: {
  title?: string;
}) {
  return (
    <ContentState kind="loading" title={title}>
      <div aria-hidden="true">
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
      </div>
    </ContentState>
  );
}

export function CareError({
  error,
  retry,
  fetching = false,
}: {
  error: unknown;
  retry?: () => void;
  fetching?: boolean;
}) {
  return (
    <ContentState
      kind="error"
      title={isExpired(error) ? "Entre novamente" : "Não foi possível carregar"}
    >
      <p>{errorMessage(error)}</p>
      {error instanceof ApiError && error.detail && (
        <p>Mensagem do serviço: {error.detail}</p>
      )}
      {isExpired(error) ? (
        <Link href="/login?expired=1">Ir para o login</Link>
      ) : (
        retry && (
          <Button variant="secondary" disabled={fetching} onClick={retry}>
            {fetching ? "Atualizando…" : "Tentar novamente"}
          </Button>
        )
      )}
    </ContentState>
  );
}
