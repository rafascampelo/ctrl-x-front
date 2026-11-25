"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ContentState } from "@/components/ui/content-state";
import { CareError, CareLoading } from "@/features/care/states";
import { getPatientCalendar, getPatientTimeline } from "@/services/timeline";
import { historyMonthKey } from "@/types/timeline";
import { getAllLinks, getAllPatients, getProfile } from "@/services/care";
import { getAllProfessionalPatientPrescriptions } from "@/services/prescriptions";
import type { PatientProfile } from "@/types/care";
import ui from "@/components/ui/ui.module.css";
import styles from "./dashboard.module.css";
import { authRequest, AuthError, dashboardPath, type User } from "./auth";

type ExerciseMonitorPatient = {
  id: string;
  full_name: string;
  session_count: number;
  latest_completion: string;
};

function dateKeyAtTimeZone(date: Date, timeZone: string) {
  const parts = new Map(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

async function getTodayExerciseActivity(
  patients: PatientProfile[],
  todayKey: string,
  timeZone: string,
  signal?: AbortSignal,
) {
  const activity: ExerciseMonitorPatient[] = [];
  let nextPatient = 0;

  async function worker() {
    while (nextPatient < patients.length) {
      const patient = patients[nextPatient++];
      if (!patient) continue;

      const prescriptions = await getAllProfessionalPatientPrescriptions(
        patient.id,
        signal,
      );
      const todayCompletions = prescriptions.flatMap((prescription) =>
        prescription.completions
          .filter(
            (completion) =>
              dateKeyAtTimeZone(new Date(completion.completed_at), timeZone) ===
              todayKey,
          )
          .map((completion) => completion.completed_at),
      );

      if (todayCompletions.length) {
        activity.push({
          id: patient.id,
          full_name: patient.full_name,
          session_count: todayCompletions.length,
          latest_completion: todayCompletions.sort().at(-1)!,
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(4, patients.length) }, () => worker()),
  );
  return activity.sort((a, b) =>
    b.latest_completion.localeCompare(a.latest_completion),
  );
}

export function Dashboard({ role }: { role: User["role"] }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const session = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authRequest("me"),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (session.data && session.data.role !== role) {
      router.replace(dashboardPath(session.data.role));
    }
  }, [session.data, role, router]);

  const userId = session.data?.id;
  const isValidRole = session.data?.role === role;

  const profile = useQuery({
    queryKey: ["care", userId, "profile"],
    queryFn: ({ signal }) => getProfile(userId!, role, signal),
    enabled: !!userId && isValidRole,
    gcTime: 0,
  });

  const links = useQuery({
    queryKey: ["care", userId, "links"],
    queryFn: ({ signal }) => getAllLinks(signal),
    enabled: !!userId && isValidRole,
    gcTime: 0,
  });

  const isProfessional = profile.data?.role === "PROFESSIONAL";

  const patientsQuery = useQuery({
    queryKey: ["care", userId, "patients"],
    queryFn: ({ signal }) => getAllPatients(signal),
    enabled: !!userId && isProfessional,
    gcTime: 0,
  });

  const now = new Date();
  const todayKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const month = historyMonthKey(now);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const patientIds = patientsQuery.data?.map((patient) => patient.id) ?? [];
  const exerciseMonitoring = useQuery({
    queryKey: [
      "care",
      userId,
      "exercise-monitoring",
      todayKey,
      timezone,
      patientIds,
    ],
    queryFn: ({ signal }) =>
      getTodayExerciseActivity(
        patientsQuery.data ?? [],
        todayKey,
        timezone,
        signal,
      ),
    enabled:
      !!userId &&
      isProfessional &&
      !patientsQuery.isPending &&
      !patientsQuery.isError,
    staleTime: 60_000,
    refetchInterval: 300_000,
    gcTime: 0,
  });
  const calendarSummary = useQuery({
    queryKey: ["care", userId, "history", "calendar", month, timezone],
    queryFn: ({ signal }) => getPatientCalendar(month, timezone, signal),
    enabled: !!userId && isValidRole && role === "PATIENT",
    gcTime: 0,
  });
  const dailyRecords = useQuery({
    queryKey: ["care", userId, "timeline", todayKey, timezone],
    queryFn: ({ signal }) =>
      getPatientTimeline({ date: todayKey, timezone }, signal),
    enabled: !!userId && isValidRole && role === "PATIENT",
    gcTime: 0,
  });
  const finalizedRecords = calendarSummary.data?.days.reduce(
    (total, day) => total + day.clinical_record_count,
    0,
  );

  if (
    session.isPending ||
    (session.error instanceof AuthError && session.error.status === 401) ||
    (session.data && session.data.role !== role)
  ) {
    return (
      <ContentState kind="loading" title="Verificando sua sessão">
        <p>Estamos preparando seu espaço de cuidado.</p>
      </ContentState>
    );
  }

  if (session.isError) {
    return (
      <ContentState
        kind="error"
        title="Não foi possível verificar sua sessão"
      >
        <p>Confira sua conexão e tente novamente.</p>
        <Button
          disabled={session.isFetching}
          onClick={() => void session.refetch()}
        >
          {session.isFetching ? "Verificando…" : "Tentar novamente"}
        </Button>
      </ContentState>
    );
  }

  const patient = role === "PATIENT";
  const firstName = profile.data?.full_name
    ? profile.data.full_name.trim().split(/\s+/)[0]
    : null;

  const activeLinks =
    links.data?.filter((link) => link.status === "active") ?? [];
  const pendingLinks =
    links.data?.filter((link) => link.status === "pending") ?? [];
  const todaySummary = calendarSummary.data?.days.find(
    (day) => day.date === todayKey,
  );
  const todayPainCount = todaySummary?.pain_count ?? 0;
  const todayExerciseCount = todaySummary?.exercise_count ?? 0;
  const todayEvents =
    dailyRecords.data?.items.filter((event) => event.category !== "clinical_record") ?? [];

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback silencioso
    }
  }

  return (
    <section className={styles.page} aria-labelledby="dashboard-title">
      <header className={styles.header}>
        <div>
          <p className={ui.eyebrow}>Meu espaço · Ctrl X</p>
          <h1 id="dashboard-title">
            {firstName
              ? `Olá, ${firstName}.`
              : patient
                ? "Seu cuidado começa aqui."
                : "Um espaço para acompanhar."}
          </h1>
          <p className={styles.subtitle}>
            {patient
              ? "Acompanhe seu vínculo terapêutico, registre sua evolução diária e acesse seu histórico clínico."
              : "Gerencie seus pacientes vinculados, elabore prontuários clínicos e prescreva rotinas de exercícios."}
          </p>
        </div>

        <div className={styles.headerActions}>
          <details className={styles.accountMenu}>
            <summary>
              <span>Minha conta</span>
              <span className={styles.menuIcon} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </summary>
            <div className={styles.accountMenuPanel}>
              <div className={styles.accountHeader}>
                <div className={styles.avatar} aria-hidden="true">
                  {(firstName?.[0] ?? session.data.email[0]).toUpperCase()}
                </div>
                <div>
                  <strong className={styles.accountName}>
                    {profile.data?.full_name || "Sua conta"}
                  </strong>
                  <span className={styles.accountRole}>
                    {patient ? "Paciente" : "Fisioterapeuta"}
                  </span>
                </div>
              </div>
              <dl className={styles.accountList}>
                <dt>E-mail cadastrado</dt>
                <dd>{session.data.email}</dd>
                {profile.data?.role === "PROFESSIONAL" && (
                  <>
                    <dt>Código para vínculo</dt>
                    <dd className={styles.copyBox}>
                      <code className={styles.code}>{profile.data.id}</code>
                      <button
                        type="button"
                        className={styles.copyButton}
                        onClick={() => void copyCode(profile.data!.id)}
                      >
                        {copied ? "Copiado!" : "Copiar código"}
                      </button>
                    </dd>
                  </>
                )}
              </dl>
              <nav aria-label="Atalhos da conta" className={styles.accountMenuLinks}>
                <Link href={patient ? "/patient/profile" : "/professional/profile"}>
                  Editar meu perfil
                </Link>
                <Link href={patient ? "/patient/physiotherapist" : "/professional/patients"}>
                  {patient ? "Gerenciar fisioterapeuta" : "Gerenciar pacientes"}
                </Link>
              </nav>
            </div>
          </details>
        </div>
      </header>

      {patient ? (
        <section className={styles.dailySummary} aria-labelledby="daily-summary-title">
          <div className={styles.dailyHeading}>
            <div>
              <p className={ui.eyebrow}>Seu dia</p>
              <h2 id="daily-summary-title">Registros de hoje</h2>
              <p className={styles.dailyDate}>
                {new Intl.DateTimeFormat("pt-BR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(now)}
              </p>
            </div>
          </div>
          {calendarSummary.isPending ? (
            <CareLoading title="Carregando seus registros de hoje" />
          ) : calendarSummary.isError ? (
            <CareError
              error={calendarSummary.error}
              fetching={calendarSummary.isFetching}
              retry={() => void calendarSummary.refetch()}
            />
          ) : (
            <>
              <dl className={styles.dailyCounts}>
                <div>
                  <dt>Dores registradas</dt>
                  <dd>{todayPainCount}</dd>
                </div>
                <div>
                  <dt>Exercícios feitos</dt>
                  <dd>{todayExerciseCount}</dd>
                </div>
              </dl>
              <p className={styles.dailyMessage}>
                {todayPainCount + todayExerciseCount === 0
                  ? "Você ainda não registrou exercícios feitos ou dores hoje."
                  : "Registros feitos hoje:"}
              </p>
              {todayPainCount + todayExerciseCount > 0 && (
                dailyRecords.isPending ? (
                  <CareLoading title="Carregando detalhes dos registros" />
                ) : dailyRecords.isError ? (
                  <CareError
                    error={dailyRecords.error}
                    fetching={dailyRecords.isFetching}
                    retry={() => void dailyRecords.refetch()}
                  />
                ) : todayEvents.length > 0 ? (
                  <ul className={styles.dailyEventList}>
                    {todayEvents.slice(0, 3).map((event) => (
                      <li key={`${event.category}-${event.id}`}>
                        <div>
                          <strong>
                            {event.category === "pain" ? "Dor registrada" : "Exercício concluído"}
                          </strong>
                          <p>{event.title}</p>
                        </div>
                        <time dateTime={event.occurred_at}>
                          {new Intl.DateTimeFormat("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(event.occurred_at))}
                        </time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.dailyMessage} role="status">
                    Há registros contabilizados, mas não foi possível exibir os detalhes agora.
                  </p>
                )
              )}
              <div className={styles.dailyActions}>
                <Link href="/patient/pain-diary" className={ui.button}>
                  Registrar dor
                </Link>
                <Link href="/patient/exercises" className={[ui.button, ui.secondary].join(" ")}>
                  Registrar exercício
                </Link>
                <Link href="/patient/timeline" className={styles.historyLink}>
                  Ver histórico diário
                </Link>
              </div>
            </>
          )}
        </section>
      ) : (
      <div className={styles.metricsGrid}>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>
            {patient ? "Acompanhamento ativo" : "Pacientes ativos"}
          </span>
          <strong className={styles.metricValue}>
            {links.isPending
              ? "—"
              : patient
                ? activeLinks.length > 0
                  ? "Conectado"
                  : "Sem vínculo"
                : activeLinks.length}
          </strong>
          <span className={styles.metricHint}>
            {patient
              ? activeLinks.length > 0
                ? "Fisioterapeuta autorizado"
                : "Conecte-se usando o código do profissional"
              : activeLinks.length === 1
                ? "1 paciente em acompanhamento"
                : `${activeLinks.length} pacientes vinculados`}
          </span>
        </article>

        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Solicitações pendentes</span>
          <strong className={styles.metricValue}>
            {links.isPending ? "—" : pendingLinks.length}
          </strong>
          <span className={styles.metricHint}>
            {pendingLinks.length > 0
              ? patient
                ? "Aguardando aceite do fisioterapeuta"
                : "Novos pedidos aguardando sua resposta"
              : "Nenhuma pendência no momento"}
          </span>
        </article>

        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>
            Status da conta
          </span>
          <strong className={styles.metricValue}>
            {profile.data?.role === "PATIENT" ||
            (profile.data?.role === "PROFESSIONAL" && profile.data.account_status === "active")
              ? "Ativa"
              : "—"}
          </strong>
          <span className={styles.metricHint}>
            {profile.data?.role === "PROFESSIONAL" &&
            profile.data.crefito_region &&
            profile.data.crefito_number
              ? `CREFITO-${profile.data.crefito_region} · ${profile.data.crefito_number}`
              : session.data.email}
          </span>
        </article>
      </div>
      )}

      <div className={styles.layout}>
        <div className={styles.primaryColumn}>
          {patient && (
            <section className={styles.surface} aria-labelledby="history-summary-title">
              <div className={styles.surfaceHeader}>
                <div>
                  <h2 id="history-summary-title">Seu histórico neste mês</h2>
                  <p className={styles.metricHint}>
                    {new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(now)}
                  </p>
                </div>
                <Link href="/patient/timeline" className={ui.button}>
                  Abrir calendário
                </Link>
              </div>
              {calendarSummary.isPending ? (
                <CareLoading title="Carregando resumo do mês" />
              ) : calendarSummary.isError ? (
                <CareError
                  error={calendarSummary.error}
                  fetching={calendarSummary.isFetching}
                  retry={() => void calendarSummary.refetch()}
                />
              ) : (
                <>
                  <dl className={styles.historyMetrics}>
                    <div>
                      <dt>Registros de dor</dt>
                      <dd>{calendarSummary.data.pain.count}</dd>
                    </div>
                    {calendarSummary.data.pain.count > 0 && (
                      <>
                        <div>
                          <dt>Intensidade média</dt>
                          <dd>{calendarSummary.data.pain.average_intensity?.toLocaleString("pt-BR")}/10</dd>
                        </div>
                        <div>
                          <dt>Última intensidade</dt>
                          <dd>{calendarSummary.data.pain.latest_intensity}/10</dd>
                        </div>
                      </>
                    )}
                    <div>
                      <dt>Prontuários finalizados</dt>
                      <dd>{finalizedRecords}</dd>
                    </div>
                  </dl>
                  {calendarSummary.data.pain.count === 0 && (
                    <p className={styles.mutedText}>
                      <Link href="/patient/pain-diary">Registrar dor no diário</Link>
                    </p>
                  )}
                </>
              )}
            </section>
          )}
          <section
            className={styles.surface}
            aria-labelledby="care-status-title"
          >
            <div className={styles.surfaceHeader}>
              <div>
                <p className={ui.eyebrow}>
                  {patient ? "Relação de cuidado" : "Carteira de pacientes"}
                </p>
                <h2 id="care-status-title">
                  {patient
                    ? "Seu fisioterapeuta"
                    : "Pacientes em acompanhamento"}
                </h2>
              </div>
              <Link
                href={
                  patient
                    ? "/patient/physiotherapist"
                    : "/professional/patients"
                }
                className={ui.button}
              >
                {patient
                  ? activeLinks.length > 0
                    ? "Gerenciar vínculo"
                    : "Conectar fisioterapeuta"
                  : "Ver meus pacientes"}
              </Link>
            </div>

            {patient ? (
              activeLinks.length > 0 ? (
                <div className={styles.statusBox}>
                  <p className={styles.statusText}>
                    Você possui um fisioterapeuta autorizado para acompanhar sua
                    evolução clínica.
                  </p>
                  <div className={styles.codeRow}>
                    <span className={styles.codeLabel}>
                      Código do profissional:
                    </span>
                    <code className={styles.inlineCode}>
                      {activeLinks[0].professional_id}
                    </code>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyBox}>
                  <p>
                    Você ainda não está vinculado a nenhum fisioterapeuta. Peça o{" "}
                    <strong>código de vínculo</strong> ao seu profissional e
                    envie uma solicitação para iniciar seu acompanhamento.
                  </p>
                </div>
              )
            ) : patientsQuery.isPending ? (
              <CareLoading title="Carregando pacientes vinculados" />
            ) : patientsQuery.isError ? (
              <CareError
                error={patientsQuery.error}
                fetching={patientsQuery.isFetching}
                retry={() => void patientsQuery.refetch()}
              />
            ) : patientsQuery.data.length > 0 ? (
              <ul className={styles.patientList}>
                {patientsQuery.data.slice(0, 4).map((p) => (
                  <li key={p.id} className={styles.patientRow}>
                    <div>
                      <strong>{p.full_name}</strong>
                      <span>Paciente vinculado</span>
                    </div>
                    <Link
                      href={`/professional/patients/${p.id}`}
                      className={[ui.button, ui.secondary, styles.smallBtn].join(
                        " ",
                      )}
                    >
                      Abrir atendimento
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.emptyBox}>
                <p>
                  {pendingLinks.length > 0
                    ? `Você tem ${pendingLinks.length} solicitação(ões) aguardando resposta na aba Meus pacientes.`
                    : "Nenhum paciente ativo no momento. Compartilhe seu código de vínculo para receber solicitações."}
                </p>
              </div>
            )}
          </section>

          {patient ? (
            <section className={styles.surface} aria-labelledby="roadmap-title">
              <p className={ui.eyebrow}>Acesso rápido</p>
              <h2 id="roadmap-title">Módulos clínicos do Ctrl X</h2>
              <p className={styles.mutedText}>
                Acesse diretamente qualquer ferramenta do seu acompanhamento:
              </p>
              <div className={styles.modulesGrid}>
                <Link
                  href="/patient/pain-diary"
                  className={styles.moduleItem}
                  style={{ textDecoration: "none" }}
                >
                  <span className={styles.moduleTag}>Módulo 04 · Dor</span>
                  <h3>Diário de Dor (EVA)</h3>
                  <p>Registre intensidade de 0 a 10 e região corporal.</p>
                </Link>

                <Link
                  href="/patient/exercises"
                  className={styles.moduleItem}
                  style={{ textDecoration: "none" }}
                >
                  <span className={styles.moduleTag}>Módulo 07 · Reabilitação</span>
                  <h3>Exercícios Prescritos</h3>
                  <p>Consulte séries, repetições e marque treinos concluídos.</p>
                </Link>

                <Link
                  href="/patient/documents"
                  className={styles.moduleItem}
                  style={{ textDecoration: "none" }}
                >
                  <span className={styles.moduleTag}>Módulo 09 · OCR</span>
                  <h3>Documentos &amp; Exames</h3>
                  <p>
                    Envio privado de laudos e validação humana do texto extraído.
                  </p>
                </Link>
              </div>
            </section>
          ) : (
            <section
              className={styles.surface}
              aria-labelledby="exercise-monitor-title"
            >
              <div className={styles.surfaceHeader}>
                <div>
                  <p className={ui.eyebrow}>Atividade do dia</p>
                  <h2 id="exercise-monitor-title">
                    Exercícios registrados hoje
                  </h2>
                  <p className={styles.mutedText}>
                    Pacientes com sessões concluídas nas rotinas prescritas.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={
                    patientsQuery.isPending || exerciseMonitoring.isFetching
                  }
                  onClick={() => void exerciseMonitoring.refetch()}
                >
                  Atualizar
                </Button>
              </div>

              {patientsQuery.isPending ? (
                <CareLoading title="Carregando pacientes vinculados" />
              ) : patientsQuery.isError ? (
                <CareError
                  error={patientsQuery.error}
                  fetching={patientsQuery.isFetching}
                  retry={() => void patientsQuery.refetch()}
                />
              ) : patientsQuery.data.length === 0 ? (
                <p className={styles.monitorEmpty}>
                  Vincule pacientes para acompanhar os exercícios registrados.
                </p>
              ) : exerciseMonitoring.isPending ? (
                <CareLoading title="Verificando sessões de exercícios" />
              ) : exerciseMonitoring.isError ? (
                <CareError
                  error={exerciseMonitoring.error}
                  fetching={exerciseMonitoring.isFetching}
                  retry={() => void exerciseMonitoring.refetch()}
                />
              ) : exerciseMonitoring.data.length > 0 ? (
                <ul className={styles.monitorList}>
                  {exerciseMonitoring.data.map((item) => (
                    <li key={item.id} className={styles.monitorRow}>
                      <div>
                        <strong>{item.full_name}</strong>
                        <span>
                          {item.session_count === 1
                            ? "1 sessão concluída"
                            : `${item.session_count} sessões concluídas`}
                        </span>
                      </div>
                      <time dateTime={item.latest_completion}>
                        Último registro às{" "}
                        {new Intl.DateTimeFormat("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: timezone,
                        }).format(new Date(item.latest_completion))}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.monitorEmpty}>
                  Ainda não há sessões concluídas registradas hoje.
                </p>
              )}
            </section>
          )}
        </div>

      </div>
    </section>
  );
}
