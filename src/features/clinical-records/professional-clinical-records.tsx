"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
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
  appendClinicalRecordAmendment,
  createClinicalRecordDraft,
  finalizeClinicalRecord,
  listClinicalRecords,
  updateClinicalRecordDraft,
} from "@/services/clinical-records";
import {
  amendmentCreateSchema,
  clinicalRecordFormSchema,
  type AmendmentInput,
  type ClinicalRecord,
  type ClinicalRecordInput,
} from "@/types/clinical-records";
import { BODY_REGIONS, formatBodyRegion } from "@/types/pain";
import styles from "./clinical-records.module.css";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function FinalizeConfirmDialog({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    el?.showModal();
    return () => el?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="finalize-title"
      onCancel={(e) => {
        if (pending) e.preventDefault();
        else onCancel();
      }}
    >
      <h2 id="finalize-title">Finalizar prontuário clínico?</h2>
      <p>
        Após finalizado, o conteúdo original deste prontuário torna-se{" "}
        <strong>imutável</strong> e ficará visível para o paciente. Caso precise
        complementar algo depois, será necessário registrar um adendo formal.
      </p>
      <div className={styles.actionsRow}>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Continuar editando
        </Button>
        <Button disabled={pending} onClick={onConfirm}>
          {pending ? "Finalizando…" : "Confirmar e finalizar"}
        </Button>
      </div>
    </dialog>
  );
}

function AmendmentFormBox({
  recordId,
  onSuccess,
}: {
  recordId: string;
  onSuccess: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AmendmentInput>({
    resolver: zodResolver(amendmentCreateSchema),
    defaultValues: { reason: "", content: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: AmendmentInput) =>
      appendClinicalRecordAmendment(recordId, values),
    onSuccess: () => {
      reset();
      onSuccess();
    },
  });

  return (
    <form
      className={styles.amendmentForm}
      noValidate
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <Feedback error={mutation.error} />
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`reason-${recordId}`}>
          Motivo do adendo / errata
        </label>
        <input
          id={`reason-${recordId}`}
          placeholder="Ex: Complemento de reavaliação funcional"
          {...register("reason")}
        />
        <span className={styles.errorText}>{errors.reason?.message}</span>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`content-${recordId}`}>
          Texto do adendo
        </label>
        <textarea
          id={`content-${recordId}`}
          rows={2}
          placeholder="Descreva a retificação ou informação complementar…"
          {...register("content")}
        />
        <span className={styles.errorText}>{errors.content?.message}</span>
      </div>
      <div>
        <Button
          type="submit"
          variant="secondary"
          className={styles.smallBtn}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Registrando adendo…" : "Salvar adendo"}
        </Button>
      </div>
    </form>
  );
}

export function ProfessionalClinicalRecords({
  patientId,
}: {
  patientId: string;
}) {
  const { user } = useCare();
  const client = useQueryClient();
  const [notice, setNotice] = useState("");
  const [editingDraft, setEditingDraft] = useState<ClinicalRecord | null>(null);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [amendingId, setAmendingId] = useState<string | null>(null);

  const patientQuery = useQuery({
    queryKey: ["care", user.id, "patient", patientId],
    queryFn: ({ signal }) => getPatient(patientId, signal),
    gcTime: 0,
  });

  const recordsQuery = useInfiniteQuery({
    queryKey: ["care", user.id, "patient", patientId, "clinical-records"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      listClinicalRecords({ patientId, cursor: pageParam }, signal),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: !!patientQuery.data,
    gcTime: 0,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClinicalRecordInput>({
    resolver: zodResolver(clinicalRecordFormSchema),
    defaultValues: {
      chief_complaint: "",
      anamnesis: "",
      physical_assessment: "",
      body_region: "lombar",
      pain_intensity: null,
      functional_limitations: "",
      therapeutic_goals: "",
      care_plan: "",
      notes: "",
    },
  });

  function loadDraftIntoForm(record: ClinicalRecord) {
    setEditingDraft(record);
    setNotice("");
    reset({
      chief_complaint: record.chief_complaint,
      anamnesis: record.anamnesis,
      physical_assessment: record.physical_assessment,
      body_region: record.body_region,
      pain_intensity: record.pain_intensity ?? null,
      functional_limitations: record.functional_limitations,
      therapeutic_goals: record.therapeutic_goals,
      care_plan: record.care_plan,
      notes: record.notes ?? "",
    });
  }

  function clearForm() {
    setEditingDraft(null);
    reset({
      chief_complaint: "",
      anamnesis: "",
      physical_assessment: "",
      body_region: "lombar",
      pain_intensity: null,
      functional_limitations: "",
      therapeutic_goals: "",
      care_plan: "",
      notes: "",
    });
  }

  const saveDraftMutation = useMutation({
    mutationFn: (values: ClinicalRecordInput) =>
      editingDraft
        ? updateClinicalRecordDraft(editingDraft.id, values)
        : createClinicalRecordDraft(patientId, values),
    onSuccess: async (saved) => {
      setNotice(
        editingDraft
          ? "Rascunho atualizado com sucesso."
          : "Rascunho de prontuário salvo.",
      );
      setEditingDraft(saved);
      await client.invalidateQueries({
        queryKey: ["care", user.id, "patient", patientId, "clinical-records"],
      });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: (id: string) => finalizeClinicalRecord(id),
    onSuccess: async () => {
      setFinalizingId(null);
      clearForm();
      setNotice("Prontuário finalizado e bloqueado para alterações.");
      await client.invalidateQueries({
        queryKey: ["care", user.id, "patient", patientId, "clinical-records"],
      });
    },
  });

  useSessionError(
    patientQuery.error ||
      recordsQuery.error ||
      saveDraftMutation.error ||
      finalizeMutation.error,
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
    return <CareLoading title="Confirmando acesso ao prontuário do paciente" />;
  }

  const isEndpointMissing =
    (recordsQuery.error instanceof ApiError &&
      recordsQuery.error.status === 404) ||
    (saveDraftMutation.error instanceof ApiError &&
      saveDraftMutation.error.status === 404);

  const records = [
    ...new Map(
      (recordsQuery.data?.pages.flatMap((p) => p.items) ?? []).map((item) => [
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

      <div className={styles.layout}>
        {/* Coluna Esquerda: Editor de Prontuário */}
        <section className={styles.surface} aria-labelledby="editor-title">
          <div className={styles.surfaceHeader}>
            <div>
              <h2 id="editor-title">
                {editingDraft
                  ? "Editando rascunho de prontuário"
                  : `Novo prontuário · ${patientQuery.data.full_name}`}
              </h2>
              <p className={styles.subtitle}>
                Salve como rascunho enquanto avalia ou finalize para tornar o
                registro definitivo.
              </p>
            </div>
            {editingDraft && (
              <Button variant="secondary" onClick={clearForm}>
                Novo registro
              </Button>
            )}
          </div>

          {isEndpointMissing && (
            <Feedback message="A interface do Prontuário Clínico Digital está pronta e aguardando a ativação da rota /api/v1/clinical-records no back-end." />
          )}

          {!isEndpointMissing && (
            <Feedback
              error={saveDraftMutation.error || finalizeMutation.error}
              message={notice}
            />
          )}

          <form
            className={styles.form}
            noValidate
            aria-busy={saveDraftMutation.isPending}
            onSubmit={handleSubmit((values) => {
              setNotice("");
              saveDraftMutation.mutate(values);
            })}
          >
            <div className={styles.field}>
              <label className={styles.label} htmlFor="chief-complaint">
                Queixa principal
              </label>
              <input
                id="chief-complaint"
                placeholder="Ex: Lombalgia irradiada após esforço físico"
                {...register("chief_complaint")}
              />
              <span className={styles.errorText}>
                {errors.chief_complaint?.message}
              </span>
            </div>

            <div className={styles.twoCols}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="body-region">
                  Região corporal avaliada
                </label>
                <select id="body-region" {...register("body_region")}>
                  {BODY_REGIONS.map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.label}
                    </option>
                  ))}
                </select>
                <span className={styles.errorText}>
                  {errors.body_region?.message}
                </span>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="pain-intensity">
                  Dor na avaliação (0–10, opcional)
                </label>
                <input
                  id="pain-intensity"
                  type="number"
                  min={0}
                  max={10}
                  placeholder="0 a 10"
                  {...register("pain_intensity", {
                    setValueAs: (v: string) =>
                      v === "" || v === null ? null : Number(v),
                  })}
                />
                <span className={styles.errorText}>
                  {errors.pain_intensity?.message}
                </span>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="anamnesis">
                Anamnese
              </label>
              <textarea
                id="anamnesis"
                className={styles.textarea}
                placeholder="Histórico da dor atual, tempo de evolução, fatores de melhora e piora…"
                {...register("anamnesis")}
              />
              <span className={styles.errorText}>
                {errors.anamnesis?.message}
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="physical-assessment">
                Avaliação física
              </label>
              <textarea
                id="physical-assessment"
                className={styles.textarea}
                placeholder="Amplitude de movimento (ADM), força muscular, testes especiais e palpação…"
                {...register("physical_assessment")}
              />
              <span className={styles.errorText}>
                {errors.physical_assessment?.message}
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="functional-limitations">
                Limitações funcionais
              </label>
              <textarea
                id="functional-limitations"
                className={styles.textarea}
                placeholder="Atividades diárias ou laborais impactadas…"
                {...register("functional_limitations")}
              />
              <span className={styles.errorText}>
                {errors.functional_limitations?.message}
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="therapeutic-goals">
                Metas terapêuticas
              </label>
              <textarea
                id="therapeutic-goals"
                className={styles.textarea}
                placeholder="Objetivos de curto, médio e longo prazo…"
                {...register("therapeutic_goals")}
              />
              <span className={styles.errorText}>
                {errors.therapeutic_goals?.message}
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="care-plan">
                Plano de cuidado / Conduta
              </label>
              <textarea
                id="care-plan"
                className={styles.textarea}
                placeholder="Recursos terapêuticos, frequência de sessões e orientações…"
                {...register("care_plan")}
              />
              <span className={styles.errorText}>
                {errors.care_plan?.message}
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="clinical-notes">
                Observações adicionais (opcional)
              </label>
              <textarea
                id="clinical-notes"
                rows={2}
                placeholder="Anotações complementares…"
                {...register("notes")}
              />
            </div>

            <div className={styles.actionsRow}>
              <Button type="submit" disabled={saveDraftMutation.isPending}>
                {saveDraftMutation.isPending
                  ? "Salvando…"
                  : editingDraft
                    ? "Atualizar rascunho"
                    : "Salvar rascunho"}
              </Button>

              {editingDraft && editingDraft.status === "draft" && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setFinalizingId(editingDraft.id)}
                >
                  Finalizar prontuário
                </Button>
              )}
            </div>
          </form>
        </section>

        {/* Coluna Direita: Lista de Rascunhos, Finalizados e Adendos */}
        <section className={styles.surface} aria-labelledby="records-list-title">
          <div className={styles.surfaceHeader}>
            <div>
              <h2 id="records-list-title">Histórico de prontuários</h2>
              <p className={styles.subtitle}>
                Rascunhos editáveis e registros finalizados imutáveis.
              </p>
            </div>
          </div>

          {recordsQuery.isPending ? (
            <CareLoading title="Carregando prontuários do paciente" />
          ) : records.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Nenhum prontuário registrado para este paciente ainda.</p>
            </div>
          ) : (
            <div className={styles.recordsList}>
              {records.map((rec) => {
                const isDraft = rec.status === "draft";
                const isSelected = editingDraft?.id === rec.id;

                return (
                  <article
                    key={rec.id}
                    className={[
                      styles.recordCard,
                      isSelected ? styles.recordCardSelected : "",
                    ].join(" ")}
                  >
                    <div className={styles.recordTop}>
                      <span
                        className={
                          isDraft ? styles.statusDraft : styles.statusFinalized
                        }
                      >
                        {isDraft ? "Rascunho" : "Finalizado"}
                      </span>
                      <span className={styles.recordDate}>
                        {formatDateTime(rec.updated_at)}
                      </span>
                    </div>

                    <h3 className={styles.recordTitle}>
                      {rec.chief_complaint} ·{" "}
                      {formatBodyRegion(rec.body_region)}
                    </h3>

                    <div className={styles.actionsRow}>
                      {isDraft ? (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            className={styles.smallBtn}
                            onClick={() => loadDraftIntoForm(rec)}
                          >
                            Editar rascunho
                          </Button>
                          <Button
                            type="button"
                            className={styles.smallBtn}
                            onClick={() => setFinalizingId(rec.id)}
                          >
                            Finalizar
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          className={styles.smallBtn}
                          onClick={() =>
                            setAmendingId((prev) =>
                              prev === rec.id ? null : rec.id,
                            )
                          }
                        >
                          {amendingId === rec.id
                            ? "Fechar adendo"
                            : "+ Adicionar adendo"}
                        </Button>
                      )}
                    </div>

                    {/* Exibição de Adendos (Append-only) */}
                    {(rec.amendments.length > 0 || amendingId === rec.id) && (
                      <div className={styles.amendmentsBox}>
                        <h4 className={styles.amendmentsTitle}>
                          Adendos ({rec.amendments.length})
                        </h4>

                        {rec.amendments.map((amend) => (
                          <div key={amend.id} className={styles.amendmentItem}>
                            <span className={styles.amendmentMeta}>
                              {formatDateTime(amend.created_at)} ·{" "}
                              {amend.reason}
                            </span>
                            <p className={styles.amendmentText}>
                              {amend.content}
                            </p>
                          </div>
                        ))}

                        {amendingId === rec.id && (
                          <AmendmentFormBox
                            recordId={rec.id}
                            onSuccess={() => {
                              setAmendingId(null);
                              setNotice("Adendo registrado ao prontuário.");
                              void client.invalidateQueries({
                                queryKey: [
                                  "care",
                                  user.id,
                                  "patient",
                                  patientId,
                                  "clinical-records",
                                ],
                              });
                            }}
                          />
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {finalizingId && (
        <FinalizeConfirmDialog
          pending={finalizeMutation.isPending}
          onCancel={() => setFinalizingId(null)}
          onConfirm={() => finalizeMutation.mutate(finalizingId)}
        />
      )}
    </div>
  );
}