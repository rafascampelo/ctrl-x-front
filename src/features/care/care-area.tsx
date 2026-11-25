"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { authRequest, type User } from "@/features/auth/auth";
import { CareError, CareLoading, isExpired } from "./states";
import { ApiError } from "@/services/api-client";
import styles from "./care.module.css";

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
  const [expired, setExpired] = useState<unknown>(null);

  const session = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authRequest("me"),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 60_000,
  });

  const error = expired || session.error;

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

  return (
    <CareContext.Provider value={{ user: session.data, expire: setExpired }}>
      <div className={styles.page}>
        <header className={styles.heading}>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>

        {children}
      </div>
    </CareContext.Provider>
  );
}
