"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authRequest, type User } from "@/features/auth/auth";
import { LogoutButton } from "@/features/auth/logout-button";
import { CareError, CareLoading, isExpired } from "./states";
import { ApiError } from "@/services/api-client";
import styles from "./care.module.css";
import ui from "@/components/ui/ui.module.css";

const CareContext = createContext<{
  user: User;
  expire: (error: unknown) => void;
} | null>(null);

export function useCare() {
  const context = useContext(CareContext);
  if (!context) throw new Error("Área autenticada necessária.");
  return context;
}

export function useSessionError(error: unknown) {
  const { expire } = useCare();
  useEffect(() => {
    if (isExpired(error)) expire(error);
  }, [error, expire]);
}

export function CareArea({
  role,
  title,
  description,
  children,
}: {
  role: User["role"];
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const client = useQueryClient();
  const [expired, setExpired] = useState<unknown>(null);

  const session = useQuery({
    queryKey: ["care-session"],
    queryFn: () => authRequest("me"),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 60_000,
  });

  const error = expired || session.error;

  useEffect(() => {
    if (isExpired(error)) {
      void client
        .cancelQueries({ queryKey: ["care"] })
        .then(() => client.removeQueries({ queryKey: ["care"] }));
      client.removeQueries({ queryKey: ["auth"] });
    }
  }, [client, error]);

  if (error) {
    return (
      <CareError
        error={error}
        retry={() => {
          setExpired(null);
          void session.refetch();
        }}
        fetching={session.isFetching}
      />
    );
  }

  if (session.isPending) return <CareLoading title="Verificando sua sessão" />;
  if (session.data.role !== role)
    return <CareError error={new ApiError(403)} />;

  const root = role === "PATIENT" ? "/patient" : "/professional";
  const relations = role === "PATIENT" ? "physiotherapist" : "patients";

  return (
    <CareContext.Provider value={{ user: session.data, expire: setExpired }}>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <nav className={styles.nav} aria-label="Seu espaço">
            <Link
              href={`${root}/dashboard`}
              aria-current={pathname === `${root}/dashboard` ? "page" : undefined}
            >
              Visão geral
            </Link>

            {role === "PATIENT" && (
              <>
                <Link
                  href="/patient/pain-diary"
                  aria-current={
                    pathname.startsWith("/patient/pain-diary")
                      ? "page"
                      : undefined
                  }
                >
                  Diário de dor
                </Link>
                <Link
                  href="/patient/timeline"
                  aria-current={
                    pathname.startsWith("/patient/timeline")
                      ? "page"
                      : undefined
                  }
                >
                  Calendário
                </Link>
                <Link
                  href="/patient/exercises"
                  aria-current={
                    pathname.startsWith("/patient/exercises")
                      ? "page"
                      : undefined
                  }
                >
                  Exercícios
                </Link>
                <Link
                  href="/patient/records"
                  aria-current={
                    pathname.startsWith("/patient/records") ? "page" : undefined
                  }
                >
                  Prontuários
                </Link>
                <Link
                  href="/patient/documents"
                  aria-current={
                    pathname.startsWith("/patient/documents")
                      ? "page"
                      : undefined
                  }
                >
                  Documentos
                </Link>
              </>
            )}

            <Link
              href={`${root}/${relations}`}
              aria-current={
                pathname.startsWith(`${root}/${relations}`) ? "page" : undefined
              }
            >
              {role === "PATIENT" ? "Meu fisioterapeuta" : "Meus pacientes"}
            </Link>

            <Link
              href={`${root}/profile`}
              aria-current={pathname === `${root}/profile` ? "page" : undefined}
            >
              Meu perfil
            </Link>
          </nav>

          <LogoutButton />
        </div>

        <header className={styles.heading}>
          <p className={ui.eyebrow}>
            {role === "PATIENT" ? "Área do paciente" : "Área do fisioterapeuta"}
          </p>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>

        {children}
      </div>
    </CareContext.Provider>
  );
}