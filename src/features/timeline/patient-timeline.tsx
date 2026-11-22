"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import ui from "@/components/ui/ui.module.css";
import { useCare, useSessionError } from "@/features/care/care-area";
import { CareError, CareLoading, Feedback } from "@/features/care/states";
import { ApiError } from "@/services/api-client";
import { getPatientCalendar, getPatientTimeline } from "@/services/timeline";
import { formatBodyRegion, getPainSeverity } from "@/types/pain";
import {
  categoryLabels,
  type CalendarDaySummary,
  type TimelineCategory,
} from "@/types/timeline";
import styles from "./timeline.module.css";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toMonthKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatEventTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export function PatientTimeline() {
  const { user } = useCare();
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | undefined>(
    undefined,
  );
  const [category, setCategory] = useState<TimelineCategory | "all">("all");

  const monthKey = toMonthKey(currentMonthDate);

  const calendarQuery = useQuery({
    queryKey: ["care", user.id, "calendar", monthKey],
    queryFn: ({ signal }) => getPatientCalendar(monthKey, signal),
    gcTime: 0,
  });

  const timelineQuery = useInfiniteQuery({
    queryKey: ["care", user.id, "timeline", { category, selectedDate }],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getPatientTimeline(
        {
          cursor: pageParam,
          category,
          date: selectedDate,
        },
        signal,
      ),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    gcTime: 0,
  });

  useSessionError(calendarQuery.error || timelineQuery.error);

  const isEndpointMissing =
    (calendarQuery.error instanceof ApiError &&
      calendarQuery.error.status === 404) ||
    (timelineQuery.error instanceof ApiError &&
      timelineQuery.error.status === 404);

  const daySummaryMap = useMemo(() => {
    const map = new Map<string, CalendarDaySummary>();
    for (const day of calendarQuery.data?.days ?? []) {
      map.set(day.date, day);
    }
    return map;
  }, [calendarQuery.data]);

  const calendarCells = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ day: number; dateKey: string } | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ day, dateKey });
    }
    return cells;
  }, [currentMonthDate]);

  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(currentMonthDate);

  const events = [
    ...new Map(
      (timelineQuery.data?.pages.flatMap((p) => p.items) ?? []).map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ];

  function shiftMonth(delta: number) {
    setCurrentMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  }

  return (
    <div className={styles.grid}>
      {/* Coluna Esquerda: Calendário */}
      <aside className={styles.surface} aria-label="Calendário de registros">
        <div className={styles.calendarHeader}>
          <h2 className={styles.calendarTitle}>{monthLabel}</h2>
          <div className={styles.monthNav}>
            <button
              type="button"
              className={styles.monthBtn}
              aria-label="Mês anterior"
              onClick={() => shiftMonth(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.monthBtn}
              aria-label="Próximo mês"
              onClick={() => shiftMonth(1)}
            >
              ›
            </button>
          </div>
        </div>

        <div className={styles.weekdays} aria-hidden="true">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className={styles.daysGrid} role="grid">
          {calendarCells.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className={styles.emptyCell} />;
            }

            const summary = daySummaryMap.get(cell.dateKey);
            const isSelected = selectedDate === cell.dateKey;
            const isToday = todayKey === cell.dateKey;

            return (
              <button
                key={cell.dateKey}
                type="button"
                aria-pressed={isSelected}
                aria-label={`Dia ${cell.day}`}
                className={[
                  styles.dayCell,
                  isToday ? styles.dayToday : "",
                  isSelected ? styles.daySelected : "",
                ].join(" ")}
                onClick={() =>
                  setSelectedDate((prev) =>
                    prev === cell.dateKey ? undefined : cell.dateKey,
                  )
                }
              >
                <span>{cell.day}</span>
                <span className={styles.dotsRow} aria-hidden="true">
                  {summary && summary.pain_count > 0 && (
                    <span className={styles.dotPain} />
                  )}
                  {summary && summary.exercise_count > 0 && (
                    <span className={styles.dotExercise} />
                  )}
                  {summary && summary.clinical_record_count > 0 && (
                    <span className={styles.dotRecord} />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.dotPain} /> Dor
          </span>
          <span className={styles.legendItem}>
            <span className={styles.dotExercise} /> Exercícios
          </span>
          <span className={styles.legendItem}>
            <span className={styles.dotRecord} /> Prontuário
          </span>
        </div>

        {selectedDate && (
          <Button
            type="button"
            variant="secondary"
            className={styles.clearFilterBtn}
            onClick={() => setSelectedDate(undefined)}
          >
            Mostrar todo o mês
          </Button>
        )}
      </aside>

      {/* Coluna Direita: Timeline Unificada */}
      <section className={styles.surface} aria-labelledby="timeline-title">
        <div className={styles.timelineHeader}>
          <div>
            <h2 id="timeline-title">
              {selectedDate
                ? `Eventos de ${selectedDate.split("-").reverse().join("/")}`
                : "Linha do tempo completa"}
            </h2>
            <p className={styles.subtitle}>
              Projeção unificada dos seus registros de dor, exercícios e
              atendimentos.
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={timelineQuery.isFetching}
            onClick={() => {
              void calendarQuery.refetch();
              void timelineQuery.refetch();
            }}
          >
            Atualizar
          </Button>
        </div>

        {isEndpointMissing && (
          <Feedback message="A interface de Calendário e Timeline está pronta e aguardando a ativação das rotas /api/v1/me/timeline e /api/v1/me/calendar no back-end." />
        )}

        {/* Filtros por Categoria */}
        <div
          className={styles.categoryBar}
          role="tablist"
          aria-label="Filtrar eventos por categoria"
        >
          {(
            [
              ["all", "Todos"],
              ["pain", "Diário de dor"],
              ["exercise", "Exercícios"],
              ["clinical_record", "Prontuários"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={category === key}
              className={[
                styles.categoryTab,
                category === key ? styles.categoryTabActive : "",
              ].join(" ")}
              onClick={() => setCategory(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {timelineQuery.isPending ? (
          <CareLoading title="Carregando linha do tempo" />
        ) : timelineQuery.isError && !isEndpointMissing ? (
          <CareError
            error={timelineQuery.error}
            retry={() => void timelineQuery.refetch()}
            fetching={timelineQuery.isFetching}
          />
        ) : events.length === 0 ? (
          <div className={styles.emptyState}>
            <p>
              Nenhum evento encontrado para os filtros selecionados. Comece
              registrando como você está se sentindo hoje.
            </p>
            <div className={styles.emptyActions}>
              <Link href="/patient/pain-diary" className={ui.button}>
                Registrar no diário de dor
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ol className={styles.timelineList}>
              {events.map((event) => {
                const painInfo =
                  typeof event.intensity === "number"
                    ? getPainSeverity(event.intensity)
                    : null;

                return (
                  <li
                    key={event.id}
                    className={styles.eventCard}
                    data-category={event.category}
                  >
                    <div className={styles.eventTop}>
                      <span
                        className={styles.categoryBadge}
                        data-category={event.category}
                      >
                        {categoryLabels[event.category]}
                      </span>
                      <time className={styles.eventTime}>
                        {formatEventTime(event.occurred_at)}
                      </time>
                    </div>

                    <h3 className={styles.eventTitle}>
                      {event.region
                        ? `${event.title} · ${formatBodyRegion(event.region)}`
                        : event.title}
                      {painInfo ? ` (${event.intensity}/10 · ${painInfo.label})` : ""}
                    </h3>

                    {event.summary && (
                      <p className={styles.eventSummary}>{event.summary}</p>
                    )}
                  </li>
                );
              })}
            </ol>

            {timelineQuery.hasNextPage && (
              <Button
                variant="secondary"
                className={styles.loadMore}
                disabled={timelineQuery.isFetchingNextPage}
                onClick={() => void timelineQuery.fetchNextPage()}
              >
                {timelineQuery.isFetchingNextPage
                  ? "Carregando…"
                  : "Carregar eventos anteriores"}
              </Button>
            )}
          </>
        )}
      </section>
    </div>
  );
}