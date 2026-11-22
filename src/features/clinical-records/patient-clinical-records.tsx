"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useCare, useSessionError } from "@/features/care/care-area";
import { CareError, CareLoading, Feedback } from "@/features/care/states";
import { ApiError } from "@/services/api-client";
import { listClinicalRecords } from "@/services/clinical-records";
import { formatBodyRegion } from "@/types/pain";
import styles from "./clinical-records.module.css";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export function PatientClinicalRecords() {
  const { user } = useCare();

  const query = useInfiniteQuery({
    queryKey: ["care", user.id, "clinical-records"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      listClinicalRecords({ cursor: pageParam }, signal),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    gcTime: 0,
  });

  useSessionError(query.error);

  const isEndpointMissing =
    query.error instanceof ApiError && query.error.status === 404;

  const records = [
    ...new Map(
      (query.data?.pages.flatMap((p) => p.items) ?? []).map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ];

  return (
    <section className={styles.surface} aria-labelledby="patient-records-title">
      <div className={styles.surfaceHeader}>
        <div>
          <h2 id="patient-records-title">Seus prontuários clínicos</h2>
          <p className={styles.subtitle}>
            Avaliações fisioterapêuticas finalizadas, planos terapêuticos e
            adendos clínicos do seu tratamento.
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
        <Feedback message="A visualização de Prontuários Clínicos está pronta e aguardando a ativação da rota /api/v1/clinical-records no back-end." />
      )}

      {query.isPending ? (
        <CareLoading title="Carregando seus prontuários" />
      ) : query.isError && !isEndpointMissing ? (
        <CareError
          error={query.error}
          retry={() => void query.refetch()}
          fetching={query.isFetching}
        />
      ) : records.length === 0 ? (
        <div className={styles.emptyState}>
          <p>
            Nenhum prontuário clínico finalizado disponível no momento. Quando
            seu fisioterapeuta finalizar uma avaliação, ela aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className={styles.recordsList}>
          {records.map((record) => (
            <article key={record.id} className={styles.recordCard}>
              <div className={styles.recordTop}>
                <span className={styles.statusFinalized}>
                  Prontuário finalizado
                </span>
                <span className={styles.recordDate}>
                  Finalizado em{" "}
                  {formatDateTime(record.finalized_at ?? record.created_at)}
                  {record.professional_name
                    ? ` · ${record.professional_name}`
                    : ""}
                </span>
              </div>

              <h3 className={styles.recordTitle}>
                {record.chief_complaint} ·{" "}
                {formatBodyRegion(record.body_region)}
                {typeof record.pain_intensity === "number"
                  ? ` (Dor ${record.pain_intensity}/10)`
                  : ""}
              </h3>

              <dl className={styles.clinicalGrid}>
                <div className={styles.clinicalBlock}>
                  <dt>Anamnese</dt>
                  <dd>{record.anamnesis}</dd>
                </div>
                <div className={styles.clinicalBlock}>
                  <dt>Avaliação física</dt>
                  <dd>{record.physical_assessment}</dd>
                </div>
                <div className={styles.clinicalBlock}>
                  <dt>Limitações funcionais</dt>
                  <dd>{record.functional_limitations}</dd>
                </div>
                <div className={styles.clinicalBlock}>
                  <dt>Metas terapêuticas</dt>
                  <dd>{record.therapeutic_goals}</dd>
                </div>
                <div className={styles.clinicalBlock}>
                  <dt>Plano de cuidado</dt>
                  <dd>{record.care_plan}</dd>
                </div>
                {record.notes && (
                  <div className={styles.clinicalBlock}>
                    <dt>Observações adicionais</dt>
                    <dd>{record.notes}</dd>
                  </div>
                )}
              </dl>

              {record.amendments.length > 0 && (
                <div className={styles.amendmentsBox}>
                  <h4 className={styles.amendmentsTitle}>
                    Adendos clínicos registrados ({record.amendments.length})
                  </h4>
                  {record.amendments.map((amend) => (
                    <div key={amend.id} className={styles.amendmentItem}>
                      <span className={styles.amendmentMeta}>
                        {formatDateTime(amend.created_at)} · Motivo:{" "}
                        {amend.reason}
                      </span>
                      <p className={styles.amendmentText}>{amend.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}