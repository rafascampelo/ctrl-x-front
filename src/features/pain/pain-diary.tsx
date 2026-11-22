"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useCare, useSessionError } from "@/features/care/care-area";
import { CareError, CareLoading, Feedback } from "@/features/care/states";
import { ApiError } from "@/services/api-client";
import { createPainRecord, listPainRecords } from "@/services/pain";
import {
  BODY_REGIONS,
  formatBodyRegion,
  getPainSeverity,
  painRecordCreateSchema,
  type PainRecordInput,
} from "@/types/pain";
import styles from "./pain-diary.module.css";

function formatRecordTimestamp(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export function PainDiary() {
  const { user } = useCare();
  const client = useQueryClient();
  const [savedNotice, setSavedNotice] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PainRecordInput>({
    resolver: zodResolver(painRecordCreateSchema),
    defaultValues: {
      region: "lombar",
      intensity: 3,
      description: "",
    },
  });

  const selectedRegion = useWatch({ control, name: "region" });
  const selectedIntensity = useWatch({ control, name: "intensity" }) ?? 0;
  const severity = getPainSeverity(selectedIntensity);

  const historyQuery = useInfiniteQuery({
    queryKey: ["care", user.id, "pain-records", { startDate, endDate }],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      listPainRecords(
        {
          cursor: pageParam,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
        signal,
      ),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    gcTime: 0,
  });

  const createMutation = useMutation({
    mutationFn: createPainRecord,
    onSuccess: async () => {
      setSavedNotice("Registro de dor salvo no seu histórico.");
      reset({
        region: selectedRegion,
        intensity: selectedIntensity,
        description: "",
      });
      await client.invalidateQueries({
        queryKey: ["care", user.id, "pain-records"],
      });
    },
  });

  useSessionError(historyQuery.error || createMutation.error);

  const isEndpointMissing =
    (historyQuery.error instanceof ApiError &&
      historyQuery.error.status === 404) ||
    (createMutation.error instanceof ApiError &&
      createMutation.error.status === 404);

  const records = [
    ...new Map(
      (historyQuery.data?.pages.flatMap((p) => p.items) ?? []).map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ];

  return (
    <div className={styles.grid}>
      {/* Coluna Esquerda: Formulário Mobile-First */}
      <section className={styles.surface} aria-labelledby="new-pain-title">
        <div className={styles.surfaceHeader}>
          <div>
            <h2 id="new-pain-title">Novo registro de dor</h2>
            <p className={styles.subtitle}>
              Toque na região do corpo e escolha a intensidade atual.
            </p>
          </div>
        </div>

        {isEndpointMissing && (
          <Feedback message="A interface do Diário de Dor está pronta e aguardando a ativação da rota /api/v1/pain-records no back-end." />
        )}

        {!isEndpointMissing && (
          <Feedback error={createMutation.error} message={savedNotice} />
        )}

        <form
          className={styles.form}
          noValidate
          aria-busy={createMutation.isPending}
          onSubmit={handleSubmit((values) => {
            setSavedNotice("");
            createMutation.mutate(values);
          })}
        >
          {/* Mapa Corporal Interativo + Chips */}
          <div className={styles.field}>
            <span className={styles.label}>1. Onde você sente desconforto?</span>
            <input type="hidden" {...register("region")} />

            <div className={styles.bodySelector}>
              <div className={styles.silhouetteBox}>
                <svg
                  viewBox="0 0 120 220"
                  className={styles.silhouetteSvg}
                  role="img"
                  aria-label="Mapa corporal interativo para seleção de região"
                >
                  {/* Silhueta Anatômica Simplificada */}
                  <circle cx="60" cy="22" r="14" fill="#d7e3de" />
                  <rect x="40" y="42" width="40" height="68" rx="14" fill="#d7e3de" />
                  <rect x="20" y="46" width="14" height="58" rx="7" fill="#d7e3de" />
                  <rect x="86" y="46" width="14" height="58" rx="7" fill="#d7e3de" />
                  <rect x="42" y="114" width="15" height="86" rx="7" fill="#d7e3de" />
                  <rect x="63" y="114" width="15" height="86" rx="7" fill="#d7e3de" />

                  {/* Pontos Clicáveis (Hotspots) */}
                  <circle
                    cx="60"
                    cy="38"
                    r="6"
                    className={[
                      styles.hotspot,
                      selectedRegion === "cervical" ? styles.hotspotActive : "",
                    ].join(" ")}
                    onClick={() =>
                      setValue("region", "cervical", { shouldValidate: true })
                    }
                  >
                    <title>Cervical / Pescoço</title>
                  </circle>

                  <circle
                    cx="36"
                    cy="50"
                    r="7"
                    className={[
                      styles.hotspot,
                      selectedRegion === "ombro_direito"
                        ? styles.hotspotActive
                        : "",
                    ].join(" ")}
                    onClick={() =>
                      setValue("region", "ombro_direito", {
                        shouldValidate: true,
                      })
                    }
                  >
                    <title>Ombro Direito</title>
                  </circle>

                  <circle
                    cx="84"
                    cy="50"
                    r="7"
                    className={[
                      styles.hotspot,
                      selectedRegion === "ombro_esquerdo"
                        ? styles.hotspotActive
                        : "",
                    ].join(" ")}
                    onClick={() =>
                      setValue("region", "ombro_esquerdo", {
                        shouldValidate: true,
                      })
                    }
                  >
                    <title>Ombro Esquerdo</title>
                  </circle>

                  <rect
                    x="48"
                    y="62"
                    width="24"
                    height="14"
                    rx="5"
                    className={[
                      styles.hotspot,
                      selectedRegion === "toracica" ? styles.hotspotActive : "",
                    ].join(" ")}
                    onClick={() =>
                      setValue("region", "toracica", { shouldValidate: true })
                    }
                  >
                    <title>Coluna Torácica</title>
                  </rect>

                  <rect
                    x="46"
                    y="82"
                    width="28"
                    height="16"
                    rx="6"
                    className={[
                      styles.hotspot,
                      selectedRegion === "lombar" ? styles.hotspotActive : "",
                    ].join(" ")}
                    onClick={() =>
                      setValue("region", "lombar", { shouldValidate: true })
                    }
                  >
                    <title>Coluna Lombar</title>
                  </rect>

                  <circle
                    cx="49"
                    cy="152"
                    r="7"
                    className={[
                      styles.hotspot,
                      selectedRegion === "joelho_direito"
                        ? styles.hotspotActive
                        : "",
                    ].join(" ")}
                    onClick={() =>
                      setValue("region", "joelho_direito", {
                        shouldValidate: true,
                      })
                    }
                  >
                    <title>Joelho Direito</title>
                  </circle>

                  <circle
                    cx="71"
                    cy="152"
                    r="7"
                    className={[
                      styles.hotspot,
                      selectedRegion === "joelho_esquerdo"
                        ? styles.hotspotActive
                        : "",
                    ].join(" ")}
                    onClick={() =>
                      setValue("region", "joelho_esquerdo", {
                        shouldValidate: true,
                      })
                    }
                  >
                    <title>Joelho Esquerdo</title>
                  </circle>
                </svg>
                <span className={styles.silhouetteCaption}>
                  Toque nos pontos
                </span>
              </div>

              <div
                className={styles.regionChips}
                role="radiogroup"
                aria-label="Região corporal"
              >
                {BODY_REGIONS.map((item) => {
                  const active = selectedRegion === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={[
                        styles.regionChip,
                        active ? styles.regionChipActive : "",
                      ].join(" ")}
                      onClick={() =>
                        setValue("region", item.id, { shouldValidate: true })
                      }
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <span className={styles.errorText}>{errors.region?.message}</span>
          </div>

          {/* Escala EVA 0 a 10 */}
          <div className={styles.field}>
            <div className={styles.evaHeader}>
              <span className={styles.label}>
                2. Intensidade da dor (Escala EVA 0–10)
              </span>
              <span className={styles.evaBadge} data-level={severity.level}>
                {selectedIntensity}/10 · {severity.label}
              </span>
            </div>

            <input
              type="hidden"
              {...register("intensity", { valueAsNumber: true })}
            />

            <div
              className={styles.evaGrid}
              role="radiogroup"
              aria-label="Intensidade da dor de 0 a 10"
            >
              {Array.from({ length: 11 }, (_, score) => {
                const itemSeverity = getPainSeverity(score);
                const active = selectedIntensity === score;
                return (
                  <button
                    key={score}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-level={itemSeverity.level}
                    className={[
                      styles.evaButton,
                      active ? styles.evaButtonActive : "",
                    ].join(" ")}
                    onClick={() =>
                      setValue("intensity", score, { shouldValidate: true })
                    }
                  >
                    {score}
                  </button>
                );
              })}
            </div>

            <div className={styles.evaLegend}>
              <span>0 · Sem dor</span>
              <span>5 · Moderada</span>
              <span>10 · Máxima</span>
            </div>
            <span className={styles.errorText}>
              {errors.intensity?.message}
            </span>
          </div>

          {/* Observação opcional */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pain-description">
              3. Observações (opcional)
            </label>
            <textarea
              id="pain-description"
              className={styles.textarea}
              placeholder="Ex: Senti fisgada ao levantar da cadeira ou após caminhada de 20 minutos."
              maxLength={1000}
              {...register("description")}
            />
            <span className={styles.errorText}>
              {errors.description?.message}
            </span>
          </div>

          <Button disabled={createMutation.isPending}>
            {createMutation.isPending
              ? "Salvando registro…"
              : "Registrar no diário"}
          </Button>
        </form>
      </section>

      {/* Coluna Direita: Histórico Filtrado */}
      <section className={styles.surface} aria-labelledby="pain-history-title">
        <div className={styles.surfaceHeader}>
          <div>
            <h2 id="pain-history-title">Histórico de registros</h2>
            <p className={styles.subtitle}>
              Seus registros ficam ordenados do mais recente para o mais antigo.
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={historyQuery.isFetching}
            onClick={() => void historyQuery.refetch()}
          >
            Atualizar
          </Button>
        </div>

        {/* Filtro por Período */}
        <div className={styles.filtersBar}>
          <div className={styles.filterField}>
            <label htmlFor="filter-start">De</label>
            <input
              id="filter-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="filter-end">Até</label>
            <input
              id="filter-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className={styles.clearBtn}
            disabled={!startDate && !endDate}
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            Limpar
          </Button>
        </div>

        {historyQuery.isPending ? (
          <CareLoading title="Carregando seu histórico de dor" />
        ) : historyQuery.isError && !isEndpointMissing ? (
          <CareError
            error={historyQuery.error}
            retry={() => void historyQuery.refetch()}
            fetching={historyQuery.isFetching}
          />
        ) : records.length === 0 ? (
          <div className={styles.emptyState}>
            <p>
              Nenhum registro de dor encontrado para este filtro. Use o
              formulário ao lado para fazer seu primeiro registro.
            </p>
          </div>
        ) : (
          <>
            <ul className={styles.recordList}>
              {records.map((item) => {
                const itemSeverity = getPainSeverity(item.intensity);
                return (
                  <li key={item.id} className={styles.recordCard}>
                    <div className={styles.recordTop}>
                      <span className={styles.recordRegion}>
                        {formatBodyRegion(item.region)}
                      </span>
                      <span
                        className={styles.recordScore}
                        data-level={itemSeverity.level}
                      >
                        {item.intensity}/10 · {itemSeverity.label}
                      </span>
                    </div>
                    {item.description && (
                      <p className={styles.recordDesc}>{item.description}</p>
                    )}
                    <span className={styles.recordDate}>
                      Registrado em{" "}
                      {formatRecordTimestamp(
                        item.recorded_at ?? item.created_at,
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>

            {historyQuery.hasNextPage && (
              <Button
                variant="secondary"
                className={styles.loadMore}
                disabled={historyQuery.isFetchingNextPage}
                onClick={() => void historyQuery.fetchNextPage()}
              >
                {historyQuery.isFetchingNextPage
                  ? "Carregando…"
                  : "Carregar mais registros"}
              </Button>
            )}
          </>
        )}
      </section>
    </div>
  );
}