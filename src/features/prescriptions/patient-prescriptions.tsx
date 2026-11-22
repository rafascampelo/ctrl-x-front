"use client";

import { useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useCare, useSessionError } from "@/features/care/care-area";
import { CareError, CareLoading, Feedback } from "@/features/care/states";
import { ApiError } from "@/services/api-client";
import {
  listPatientPrescriptions,
  logPrescriptionCompletion,
} from "@/services/prescriptions";
import styles from "./prescriptions.module.css";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export function PatientPrescriptions() {
  const { user } = useCare();
  const client = useQueryClient();
  const [notice, setNotice] = useState("");
  const [completingId, setCompletingId] = useState<string | null>(null);

  const query = useInfiniteQuery({
    queryKey: ["care", user.id, "prescriptions"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      listPatientPrescriptions(pageParam, signal),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    gcTime: 0,
  });

  const completeMutation = useMutation({
    mutationFn: (prescriptionId: string) =>
      logPrescriptionCompletion(prescriptionId),
    onSuccess: async () => {
      setCompletingId(null);
      setNotice("Sessão de exercícios registrada no seu calendário.");
      await client.invalidateQueries({
        queryKey: ["care", user.id, "prescriptions"],
      });
      await client.invalidateQueries({
        queryKey: ["care", user.id, "timeline"],
      });
    },
    onSettled: () => setCompletingId(null),
  });

  useSessionError(query.error || completeMutation.error);

  const isEndpointMissing =
    (query.error instanceof ApiError && query.error.status === 404) ||
    (completeMutation.error instanceof ApiError &&
      completeMutation.error.status === 404);

  const prescriptions = [
    ...new Map(
      (query.data?.pages.flatMap((p) => p.items) ?? []).map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ];

  return (
    <section className={styles.surface} aria-labelledby="patient-rx-title">
      <div className={styles.surfaceHeader}>
        <div>
          <h2 id="patient-rx-title">Suas rotinas de exercícios</h2>
          <p className={styles.subtitle}>
            Siga as orientações do seu fisioterapeuta e registre cada treino
            concluído.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Atualizar
        </Button>
      </div>

      {isEndpointMissing && (
        <Feedback message="A tela de Prescrição de Exercícios está pronta e aguardando a ativação da rota /api/v1/me/prescriptions no back-end." />
      )}

      {!isEndpointMissing && (
        <Feedback error={completeMutation.error} message={notice} />
      )}

      {query.isPending ? (
        <CareLoading title="Carregando suas prescrições" />
      ) : query.isError && !isEndpointMissing ? (
        <CareError
          error={query.error}
          retry={() => void query.refetch()}
          fetching={query.isFetching}
        />
      ) : prescriptions.length === 0 ? (
        <div className={styles.emptyState}>
          <p>
            Você ainda não possui rotinas de exercícios prescritas. Quando seu
            fisioterapeuta vinculado criar uma rotina, ela aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className={styles.prescriptionsList}>
          {prescriptions.map((rx) => {
            const isLoggingThis =
              completeMutation.isPending && completingId === rx.id;

            return (
              <article key={rx.id} className={styles.prescriptionCard}>
                <div className={styles.cardTop}>
                  <div>
                    <h3 className={styles.cardTitle}>{rx.title}</h3>
                    <div className={styles.metaRow}>
                      <span>
                        Prescrito em {formatDate(rx.created_at)}
                        {rx.professional_name
                          ? ` por ${rx.professional_name}`
                          : ""}
                      </span>
                    </div>
                  </div>
                  <span className={styles.frequencyBadge}>{rx.frequency}</span>
                </div>

                {rx.clinical_notes && (
                  <p className={styles.clinicalNotes}>{rx.clinical_notes}</p>
                )}

                <ul className={styles.exerciseList}>
                  {rx.exercises.map((ex, index) => (
                    <li
                      key={ex.id ?? `${rx.id}-${index}`}
                      className={styles.exerciseItem}
                    >
                      <div>
                        <p className={styles.exerciseName}>{ex.name}</p>
                        {ex.notes && (
                          <p className={styles.exerciseNotes}>{ex.notes}</p>
                        )}
                      </div>
                      <span className={styles.dosagePill}>
                        {ex.sets}x · {ex.reps}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className={styles.cardFooter}>
                  <span className={styles.completionCount}>
                    Sessões concluídas:{" "}
                    <strong>{rx.completions.length}</strong>
                  </span>
                  <Button
                    disabled={completeMutation.isPending}
                    onClick={() => {
                      setNotice("");
                      setCompletingId(rx.id);
                      completeMutation.mutate(rx.id);
                    }}
                  >
                    {isLoggingThis
                      ? "Registrando…"
                      : "Marcar treino como concluído"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}