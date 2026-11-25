"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import ui from "@/components/ui/ui.module.css";
import { ApiError } from "@/services/api-client";
import {
  getAllLinks,
  getPatients,
  getProfile,
  requestLink,
  transitionLink,
} from "@/services/care";
import {
  linkRequestSchema,
  linkStatusLabels,
  type CareLink,
} from "@/types/care";
import { useCare, useSessionError } from "./care-area";
import { ConfirmEndLink } from "./confirm-end-link";
import { CareError, CareLoading, Feedback } from "./states";
import styles from "./care.module.css";

export function LinkStatus({ status }: { status: CareLink["status"] }) {
  return (
    <span
      className={`${styles.status} ${status !== "active" ? styles.neutral : ""}`}
    >
      {linkStatusLabels[status]}
    </span>
  );
}

function linkDate(link: CareLink) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(link.created_at));
}

export function LinkIdentity({
  link,
  patient,
}: {
  link: CareLink;
  patient: boolean;
}) {
  return (
    <div>
      <LinkStatus status={link.status} />
      <p className={styles.muted}>
        {patient ? "Código do fisioterapeuta" : "Código do paciente"}
      </p>
      <code className={styles.code}>
        {patient ? link.professional_id : link.patient_id}
      </code>
      <p className={styles.muted}>
        Solicitado em {linkDate(link)}
        {link.status === "active" ? " · Solicitação aceita" : ""}
      </p>
    </div>
  );
}

export function RequestLinkForm({
  disabled,
  pending,
  onSubmit,
}: {
  disabled: boolean;
  pending: boolean;
  onSubmit: (professionalId: string) => Promise<boolean>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ professional_id: string }>({
    resolver: zodResolver(linkRequestSchema),
    defaultValues: { professional_id: "" },
  });
  return (
    <form
      className={styles.form}
      noValidate
      aria-busy={pending}
      onSubmit={handleSubmit(async (values) => {
        if (await onSubmit(values.professional_id)) reset();
      })}
    >
      <div className={styles.field}>
        <label htmlFor="professional-id">Código do fisioterapeuta</label>
        <input
          id="professional-id"
          autoComplete="off"
          spellCheck={false}
          placeholder="Cole o código recebido"
          disabled={disabled || pending}
          required
          aria-invalid={!!errors.professional_id}
          aria-describedby="professional-hint professional-error"
          {...register("professional_id")}
        />
        <small id="professional-hint">
          Peça ao fisioterapeuta o código disponível no perfil dele.
        </small>
        <span className={styles.fieldError} id="professional-error">
          {errors.professional_id?.message}
        </span>
      </div>
      <div className={styles.actions}>
        <Button disabled={disabled || pending}>
          {pending ? "Enviando…" : "Solicitar vínculo"}
        </Button>
      </div>
    </form>
  );
}

export function PatientsList() {
  const { user } = useCare();
  const query = useInfiniteQuery({
    queryKey: ["care", user.id, "patients"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getPatients(pageParam, signal),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    gcTime: 0,
    refetchInterval: 30_000,
  });
  useSessionError(query.error);
  if (query.isError)
    return (
      <CareError
        error={query.error}
        retry={() => void query.refetch()}
        fetching={query.isFetching}
      />
    );
  if (query.isPending)
    return <CareLoading title="Carregando pacientes vinculados" />;
  const patients = [
    ...new Map(
      query.data.pages
        .flatMap((page) => page.items)
        .map((patient) => [patient.id, patient]),
    ).values(),
  ];
  return (
    <section className={styles.surface} aria-labelledby="patients-title">
      <div className={styles.sectionHeader}>
        <h2 id="patients-title">Pacientes com vínculo ativo</h2>
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Atualizar pacientes
        </Button>
      </div>
      {patients.length ? (
        <ul className={styles.list}>
          {patients.map((patient) => (
            <li className={styles.row} key={patient.id}>
              <div>
                <h3>{patient.full_name}</h3>
                <p className={styles.muted}>Paciente vinculado</p>
              </div>
              <Link
                href={`/professional/patients/${patient.id}`}
                className={[ui.button, ui.secondary, styles.patientAction].join(" ")}
              >
                Ver identificação de {patient.full_name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>
          Nenhum paciente vinculado. Ao aceitar uma solicitação, o paciente
          aparecerá aqui.
        </p>
      )}
      {query.hasNextPage && (
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Carregando…" : "Carregar mais pacientes"}
        </Button>
      )}
    </section>
  );
}

type LinkAction = { id: string; action: "accept" | "reject" | "revoke" };

export function RelationshipsPage() {
  const { user } = useCare();
  const patient = user.role === "PATIENT";
  const client = useQueryClient();
  const [notice, setNotice] = useState("");
  const [ending, setEnding] = useState<string | null>(null);
  const profile = useQuery({
    queryKey: ["care", user.id, "profile"],
    queryFn: ({ signal }) => getProfile(user.id, user.role, signal),
    gcTime: 0,
  });
  const links = useQuery({
    queryKey: ["care", user.id, "links"],
    queryFn: async ({ signal }) => {
      const items = await getAllLinks(signal);
      const identity = profile.data?.id;
      if (
        !identity ||
        items.some(
          (link) =>
            (patient ? link.patient_id : link.professional_id) !== identity,
        )
      )
        throw new ApiError(403);
      return items;
    },
    enabled: !!profile.data && !profile.isError,
    gcTime: 0,
    refetchInterval: 30_000,
  });

  async function refreshRelationships() {
    await client.cancelQueries({ queryKey: ["care", user.id, "patient"] });
    client.removeQueries({ queryKey: ["care", user.id, "patient"] });
    // Clear names from prior authorization before loading the current patient list.
    await client.cancelQueries({ queryKey: ["care", user.id, "patients"] });
    client.removeQueries({ queryKey: ["care", user.id, "patients"] });
    await client.invalidateQueries({ queryKey: ["care", user.id, "links"] });
  }

  const action = useMutation({
    mutationFn: ({ id, action }: LinkAction) => transitionLink(id, action),
    onSuccess: async (_data, variables) => {
      setEnding(null);
      setNotice(
        variables.action === "accept"
          ? "Solicitação aceita. O vínculo está ativo."
          : variables.action === "reject"
            ? "Solicitação recusada."
            : "Vínculo ou solicitação encerrado pelo serviço.",
      );
      await refreshRelationships();
    },
    onError: async (error) => {
      setNotice("");
      if (error instanceof ApiError && [403, 404, 409].includes(error.status))
        await refreshRelationships();
    },
  });
  const request = useMutation({
    mutationFn: requestLink,
    onSuccess: async () => {
      setNotice("Solicitação enviada. Aguarde a resposta do fisioterapeuta.");
      await refreshRelationships();
    },
    onError: async (error) => {
      setNotice("");
      if (error instanceof ApiError && error.status === 409)
        await refreshRelationships();
    },
  });
  useSessionError(
    profile.error || links.error || action.error || request.error,
  );
  if (profile.isError || links.isError)
    return (
      <CareError
        error={profile.error || links.error}
        retry={() => {
          void profile.refetch();
          void links.refetch();
        }}
        fetching={profile.isFetching || links.isFetching}
      />
    );
  if (profile.isPending || links.isPending)
    return <CareLoading title="Carregando seus vínculos" />;
  const active = links.data.filter((link) => link.status === "active");
  const pending = links.data.filter((link) => link.status === "pending");
  const history = links.data
    .filter((link) => !["active", "pending"].includes(link.status))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const busy = action.isPending || request.isPending || links.isFetching;
  function transition(id: string, nextAction: LinkAction["action"]) {
    setNotice("");
    request.reset();
    action.reset();
    action.mutate({ id, action: nextAction });
  }
  return (
    <div className={styles.stack}>
      <Feedback
        error={!ending ? action.error || request.error : undefined}
        message={notice}
      />
      {patient && (
        <div className={styles.columns}>
          <section
            className={styles.surface}
            aria-labelledby="current-link-title"
          >
            <div className={styles.sectionHeader}>
              <h2 id="current-link-title">Seu acompanhamento</h2>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void links.refetch()}
              >
                Atualizar vínculos
              </Button>
            </div>
            {active.length ? (
              <>
                <LinkIdentity link={active[0]} patient />
                <div className={styles.actions}>
                  <Button
                    variant="secondary"
                    className={styles.danger}
                    disabled={busy}
                    onClick={() => {
                      action.reset();
                      setEnding(active[0].id);
                    }}
                  >
                    Encerrar vínculo
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3>Você ainda não tem um vínculo ativo</h3>
                <p>
                  Conecte-se ao fisioterapeuta que acompanha você. O vínculo
                  começa após o aceite da solicitação.
                </p>
              </>
            )}
          </section>
          <aside className={styles.aside}>
            <h2>Você decide com quem se conectar</h2>
            <p>
              O pedido pendente aguarda uma resposta. Você pode cancelá-lo antes
              do aceite.
            </p>
            <p>
              Para trocar de fisioterapeuta, encerre primeiro seu vínculo ativo.
            </p>
          </aside>
        </div>
      )}
      {patient && !active.length && (
        <section className={styles.surface} aria-labelledby="request-title">
          <h2 id="request-title">Conectar com um fisioterapeuta</h2>
          <RequestLinkForm
            disabled={busy}
            pending={request.isPending}
            onSubmit={async (id) => {
              action.reset();
              setNotice("");
              try {
                await request.mutateAsync(id);
                return true;
              } catch {
                return false;
              }
            }}
          />
        </section>
      )}
      {!patient && <PatientsList />}
      <section className={styles.surface} aria-labelledby="requests-title">
        <div className={styles.sectionHeader}>
          <h2 id="requests-title">
            {patient ? "Suas solicitações" : "Solicitações recebidas"}
          </h2>
          {!patient && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void links.refetch()}
            >
              Atualizar solicitações
            </Button>
          )}
        </div>
        {pending.length ? (
          <ul className={styles.list}>
            {pending.map((link) => (
              <li className={styles.row} key={link.id}>
                <LinkIdentity link={link} patient />
                <div className={styles.actions}>
                  {patient ? (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => transition(link.id, "revoke")}
                    >
                      Cancelar solicitação
                    </Button>
                  ) : (
                    <>
                      <Button
                        disabled={busy}
                        onClick={() => transition(link.id, "accept")}
                      >
                        Aceitar solicitação
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => transition(link.id, "reject")}
                      >
                        Recusar
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>Nenhuma solicitação pendente.</p>
        )}
        {!patient && (
          <p className={styles.muted}>
            Antes do aceite, o serviço disponibiliza somente o código do
            paciente. Confirme esse código com a pessoa que solicitou o vínculo.
          </p>
        )}
      </section>
      {!patient && active.length > 0 && (
        <section className={styles.surface}>
          <h2>Vínculos ativos</h2>
          <ul className={styles.list}>
            {active.map((link) => (
              <li className={styles.row} key={link.id}>
                <LinkIdentity link={link} patient={false} />
                <Button
                  variant="secondary"
                  className={styles.danger}
                  disabled={busy}
                  onClick={() => {
                    action.reset();
                    setEnding(link.id);
                  }}
                >
                  Encerrar vínculo
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {history.length > 0 && (
        <section className={styles.surface}>
          <h2>Histórico de vínculos</h2>
          <ul className={styles.list}>
            {history.map((link) => (
              <li className={styles.row} key={link.id}>
                <LinkIdentity link={link} patient={patient} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {ending && (
        <ConfirmEndLink
          pending={action.isPending}
          error={action.error}
          onCancel={() => setEnding(null)}
          onConfirm={() => {
            setNotice("");
            action.mutate({ id: ending, action: "revoke" });
          }}
        />
      )}
    </div>
  );
}
