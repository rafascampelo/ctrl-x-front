"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/features/auth/logout-button";
import { getProfile, updateProfile } from "@/services/care";
import { ApiError } from "@/services/api-client";
import {
  profileFormSchema,
  type Profile,
  type ProfileValues,
} from "@/types/care";
import { useCare, useSessionError } from "./care-area";
import { CareError, CareLoading, Feedback } from "./states";
import styles from "./care.module.css";

export function ProfileFacts({
  profile,
  email,
}: {
  profile: Profile;
  email: string;
}) {
  return (
    <dl className={styles.facts}>
      <dt>E-mail da conta</dt>
      <dd>{email}</dd>
      <dt>Perfil de acesso</dt>
      <dd>{profile.role === "PATIENT" ? "Paciente" : "Fisioterapeuta"}</dd>
      {profile.role === "PROFESSIONAL" && (
        <>
          {profile.account_status === "active" && (
            <>
              <dt>Status da conta</dt>
              <dd>Ativa</dd>
            </>
          )}
          <dt>Código para vínculo</dt>
          <dd>
            <code className={styles.code}>{profile.id}</code>
            <p className={styles.muted}>
              Compartilhe este código com o paciente para receber uma
              solicitação.
            </p>
          </dd>
          <dt>CREFITO informado</dt>
          <dd>
            {profile.crefito_region && profile.crefito_number
              ? `CREFITO-${profile.crefito_region} · ${profile.crefito_number}`
              : "Registro não informado"}
          </dd>
        </>
      )}
    </dl>
  );
}

function defaults(profile: Profile): ProfileValues {
  if (profile.role === "PROFESSIONAL")
    return {
      role: profile.role,
      full_name: profile.full_name,
      crefito_region: profile.crefito_region ?? Number.NaN,
      crefito_number: profile.crefito_number ?? "",
    };
  return { role: profile.role, full_name: profile.full_name };
}

export function ProfileEditor({ profile }: { profile: Profile }) {
  const { user } = useCare();
  const client = useQueryClient();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: defaults(profile),
  });
  const mutation = useMutation({
    mutationFn: (values: ProfileValues) => updateProfile(profile, values),
    onSuccess: async (updated) => {
      reset(defaults(updated));
      client.setQueryData(["care", user.id, "profile"], updated);
      await client.cancelQueries({ queryKey: ["care", user.id, "patient"] });
      client.removeQueries({ queryKey: ["care", user.id, "patient"] });
      client.removeQueries({ queryKey: ["care", user.id, "patients"] });
      setSaved(true);
    },
  });
  useSessionError(mutation.error);
  const professionalErrors = errors as {
    crefito_region?: { message?: string };
    crefito_number?: { message?: string };
  };
  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit((values) => {
        setSaved(false);
        mutation.mutate(values);
      })}
      onChange={() => setSaved(false)}
      noValidate
      aria-busy={mutation.isPending}
    >
      <h2>Dados do perfil</h2>
      <Feedback
        error={mutation.error}
        message={saved ? "Perfil atualizado com sucesso." : undefined}
      />
      <div className={styles.field}>
        <label htmlFor="full-name">Nome completo</label>
        <input
          id="full-name"
          autoComplete="name"
          maxLength={200}
          required
          disabled={mutation.isPending}
          aria-invalid={!!errors.full_name}
          aria-describedby="full-name-error"
          {...register("full_name")}
        />
        <span className={styles.fieldError} id="full-name-error">
          {errors.full_name?.message}
        </span>
      </div>
      {profile.role === "PROFESSIONAL" && (
        <fieldset className={styles.fieldset} disabled={mutation.isPending}>
          <legend>Registro de fisioterapeuta</legend>
          <div className={styles.pair}>
            <div className={styles.field}>
              <label htmlFor="crefito-region">Região</label>
              <input
                id="crefito-region"
                type="number"
                min={1}
                max={22}
                inputMode="numeric"
                required
                aria-invalid={!!professionalErrors.crefito_region}
                aria-describedby="region-error"
                {...register("crefito_region", { valueAsNumber: true })}
              />
              <span id="region-error" className={styles.fieldError}>
                {professionalErrors.crefito_region?.message}
              </span>
            </div>
            <div className={styles.field}>
              <label htmlFor="crefito-number">Número do CREFITO</label>
              <input
                id="crefito-number"
                maxLength={20}
                required
                placeholder="12345-F"
                aria-invalid={!!professionalErrors.crefito_number}
                aria-describedby="number-hint number-error"
                {...register("crefito_number")}
              />
              <small id="number-hint">
                Número de registro de fisioterapeuta, com sufixo -F.
              </small>
              <span id="number-error" className={styles.fieldError}>
                {professionalErrors.crefito_number?.message}
              </span>
            </div>
          </div>
        </fieldset>
      )}
      <div className={styles.actions}>
        <Button disabled={mutation.isPending || !isDirty}>
          {mutation.isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}

export function ProfilePage() {
  return (
    <>
      <div className={styles.logoutRow}><LogoutButton /></div>
      <ProfileContent />
    </>
  );
}

function ProfileContent() {
  const { user } = useCare();
  const query = useQuery({
    queryKey: ["care", user.id, "profile"],
    queryFn: ({ signal }) => getProfile(user.id, user.role, signal),
    gcTime: 0,
  });
  useSessionError(query.error);
  const canKeepDraft =
    query.data &&
    (query.error instanceof TypeError ||
      (query.error instanceof ApiError && query.error.status >= 500));
  if (query.isError && !canKeepDraft)
    return (
      <CareError
        error={query.error}
        retry={() => void query.refetch()}
        fetching={query.isFetching}
      />
    );
  if (!query.data) return <CareLoading />;
  return (
    <div className={styles.columns}>
      <section className={styles.surface}>
        {query.isError && (
          <>
            <Feedback error={query.error} />
            <Button
              variant="secondary"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Atualizar perfil
            </Button>
          </>
        )}
        <ProfileEditor key={query.data.id} profile={query.data} />
      </section>
      <aside className={styles.aside} aria-label="Informações da conta">
        <h2>Sua identificação</h2>
        <ProfileFacts profile={query.data} email={user.email} />
        <p className={styles.muted}>
          E-mail e perfil de acesso são definidos pela conta e aparecem aqui
          para consulta.
        </p>
      </aside>
    </div>
  );
}
