"use client";

import Link from "next/link";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useCare, useSessionError } from "@/features/care/care-area";
import { CareError, CareLoading, Feedback } from "@/features/care/states";
import { ApiError } from "@/services/api-client";
import { getPatient } from "@/services/care";
import {
  createPatientPrescription,
  listProfessionalPatientPrescriptions,
} from "@/services/prescriptions";
import {
  prescriptionCreateSchema,
  type PrescriptionInput,
} from "@/types/prescriptions";
import styles from "./prescriptions.module.css";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export function ProfessionalPrescriptions({
  patientId,
}: {
  patientId: string;
}) {
  const { user } = useCare();
  const client = useQueryClient();
  const [notice, setNotice] = useState("");

  const patientQuery = useQuery({
    queryKey: ["care", user.id, "patient", patientId],
    queryFn: ({ signal }) => getPatient(patientId, signal),
    gcTime: 0,
  });

  const listQuery = useInfiniteQuery({
    queryKey: ["care", user.id, "patient", patientId, "prescriptions"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      listProfessionalPatientPrescriptions(patientId, pageParam, signal),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: !!patientQuery.data,
    gcTime: 0,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PrescriptionInput>({
    resolver: zodResolver(prescriptionCreateSchema),
    defaultValues: {
      title: "",
      frequency: "3x por semana",
      clinical_notes: "",
      exercises: [{ name: "", sets: 3, reps: "12 repetições", notes: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "exercises",
  });

  const createMutation = useMutation({
    mutationFn: (values: PrescriptionInput) =>
      createPatientPrescription(patientId, values),
    onSuccess: async () => {
      setNotice("Prescrição criada e liberada para o paciente.");
      reset({
        title: "",
        frequency: "3x por semana",
        clinical_notes: "",
        exercises: [{ name: "", sets: 3, reps: "12 repetições", notes: "" }],
      });
      await client.invalidateQueries({
        queryKey: ["care", user.id, "patient", patientId, "prescriptions"],
      });
    },
  });

  useSessionError(
    patientQuery.error || listQuery.error || createMutation.error,
  );

  if (patientQuery.isError) {
    return (
      <CareError
        error={patientQuery.error}
        retry={() => void patientQuery.refetch()}
        fetching={patientQuery.isFetching}
      />
    );
  }

  if (patientQuery.isPending) {
    return <CareLoading title="Confirmando autorização do paciente" />;
  }

  const isEndpointMissing =
    (listQuery.error instanceof ApiError && listQuery.error.status === 404) ||
    (createMutation.error instanceof ApiError &&
      createMutation.error.status === 404);

  const prescriptions = [
    ...new Map(
      (listQuery.data?.pages.flatMap((p) => p.items) ?? []).map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ];

  return (
    <div className={styles.stack}>
      <div>
        <Link href={`/professional/patients/${patientId}`}>
          ← Voltar para ficha de {patientQuery.data.full_name}
        </Link>
      </div>

      <div className={styles.splitGrid}>
        {/* Formulário de Nova Prescrição */}
        <section className={styles.surface} aria-labelledby="new-rx-title">
          <div className={styles.surfaceHeader}>
            <div>
              <h2 id="new-rx-title">
                Nova rotina para {patientQuery.data.full_name}
              </h2>
              <p className={styles.subtitle}>
                Monte a sequência de exercícios, dosagem e frequência semanal.
              </p>
            </div>
          </div>

          {isEndpointMissing && (
            <Feedback message="A interface de Prescrições está pronta e aguardando a ativação da rota /api/v1/patients/{patientId}/prescriptions no back-end." />
          )}

          {!isEndpointMissing && (
            <Feedback error={createMutation.error} message={notice} />
          )}

          <form
            className={styles.form}
            noValidate
            aria-busy={createMutation.isPending}
            onSubmit={handleSubmit((values) => {
              setNotice("");
              createMutation.mutate(values);
            })}
          >
            <div className={styles.field}>
              <label className={styles.label} htmlFor="rx-title">
                Título da rotina
              </label>
              <input
                id="rx-title"
                placeholder="Ex: Fortalecimento de Core e Estabilização Lombar"
                {...register("title")}
              />
              <span className={styles.errorText}>{errors.title?.message}</span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="rx-frequency">
                Frequência / Agenda
              </label>
              <input
                id="rx-frequency"
                placeholder="Ex: Segunda, Quarta e Sexta (1x ao dia)"
                {...register("frequency")}
              />
              <span className={styles.errorText}>
                {errors.frequency?.message}
              </span>
            </div>

            <div className={styles.exercisesBuilder}>
              <div className={styles.builderHeader}>
                <h3>Exercícios ({fields.length})</h3>
                <Button
                  type="button"
                  variant="secondary"
                  className={styles.addExerciseBtn}
                  onClick={() =>
                    append({ name: "", sets: 3, reps: "10 repetições", notes: "" })
                  }
                >
                  + Adicionar exercício
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className={styles.exerciseDraftCard}>
                  <div className={styles.draftTop}>
                    <span className={styles.draftIndex}>
                      Exercício #{index + 1}
                    </span>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => remove(index)}
                      >
                        Remover
                      </button>
                    )}
                  </div>

                  <div className={styles.field}>
                    <label
                      className={styles.label}
                      htmlFor={`ex-name-${index}`}
                    >
                      Nome do exercício
                    </label>
                    <input
                      id={`ex-name-${index}`}
                      placeholder="Ex: Ponte dorsal isométrica"
                      {...register(`exercises.${index}.name`)}
                    />
                    <span className={styles.errorText}>
                      {errors.exercises?.[index]?.name?.message}
                    </span>
                  </div>

                  <div className={styles.setsRepsRow}>
                    <div className={styles.field}>
                      <label
                        className={styles.label}
                        htmlFor={`ex-sets-${index}`}
                      >
                        Séries
                      </label>
                      <input
                        id={`ex-sets-${index}`}
                        type="number"
                        min={1}
                        max={20}
                        {...register(`exercises.${index}.sets`, {
                          valueAsNumber: true,
                        })}
                      />
                    </div>

                    <div className={styles.field}>
                      <label
                        className={styles.label}
                        htmlFor={`ex-reps-${index}`}
                      >
                        Repetições / Tempo
                      </label>
                      <input
                        id={`ex-reps-${index}`}
                        placeholder="Ex: 12 reps ou 30 seg"
                        {...register(`exercises.${index}.reps`)}
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label
                      className={styles.label}
                      htmlFor={`ex-notes-${index}`}
                    >
                      Orientação de execução (opcional)
                    </label>
                    <input
                      id={`ex-notes-${index}`}
                      placeholder="Ex: Manter abdômen contraído e respiração contínua"
                      {...register(`exercises.${index}.notes`)}
                    />
                  </div>
                </div>
              ))}
              <span className={styles.errorText}>
                {errors.exercises?.message}
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="rx-notes">
                Orientações gerais (opcional)
              </label>
              <textarea
                id="rx-notes"
                rows={3}
                placeholder="Ex: Interromper o movimento caso a dor ultrapasse 5/10."
                {...register("clinical_notes")}
              />
            </div>

            <Button disabled={createMutation.isPending}>
              {createMutation.isPending
                ? "Salvando prescrição…"
                : "Prescrever rotina"}
            </Button>
          </form>
        </section>

        {/* Prescrições Ativas do Paciente */}
        <section className={styles.surface} aria-labelledby="rx-history-title">
          <div className={styles.surfaceHeader}>
            <div>
              <h2 id="rx-history-title">Rotinas prescritas</h2>
              <p className={styles.subtitle}>
                Histórico de prescrições e adesão do paciente.
              </p>
            </div>
          </div>

          {listQuery.isPending ? (
            <CareLoading title="Carregando prescrições do paciente" />
          ) : prescriptions.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Nenhuma rotina prescrita ainda para este paciente.</p>
            </div>
          ) : (
            <div className={styles.prescriptionsList}>
              {prescriptions.map((rx) => (
                <article key={rx.id} className={styles.prescriptionCard}>
                  <div className={styles.cardTop}>
                    <div>
                      <h3 className={styles.cardTitle}>{rx.title}</h3>
                      <span className={styles.metaRow}>
                        Criada em {formatDate(rx.created_at)}
                      </span>
                    </div>
                    <span className={styles.frequencyBadge}>
                      {rx.frequency}
                    </span>
                  </div>

                  <ul className={styles.exerciseList}>
                    {rx.exercises.map((ex, idx) => (
                      <li
                        key={ex.id ?? `${rx.id}-${idx}`}
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
                      Concluído pelo paciente:{" "}
                      <strong>{rx.completions.length} vez(es)</strong>
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}