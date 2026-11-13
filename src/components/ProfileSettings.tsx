import { useEffect, useId, useRef, useState } from "react";
import { useStore, type ConfigStatus } from "@/state/store";
import { t } from "@/lib/i18n";
import { saveTeamProfile } from "@/lib/own-profile";
import { IMAGE_MAX_BYTES, isImageFile } from "@/lib/composer-attachments";
import type { LocaleKey } from "@/locales";
import { AboutMeSettings } from "./AboutMeSettings";
import { profileInitials } from "./SidebarProfileMenu";
import { User } from "lucide-react";

const PHOTO_MIN_SIDE = 64;
const PHOTO_MAX_SIDE = 8192;

/** Checked before the picture is even decoded; null when the file may become a draft. */
export function profilePhotoFileProblem(file: { type: string; size: number }): LocaleKey | null {
  if (!isImageFile(file)) return "settings.profile.avatar.invalidType";
  if (file.size > IMAGE_MAX_BYTES) return "settings.profile.avatar.tooLarge";
  return null;
}

export function profilePhotoSizeProblem(width: number, height: number): LocaleKey | null {
  if (width < PHOTO_MIN_SIDE || height < PHOTO_MIN_SIDE) return "settings.profile.avatar.tooSmall";
  if (width > PHOTO_MAX_SIDE || height > PHOTO_MAX_SIDE) return "settings.profile.avatar.tooLargeDimensions";
  return null;
}

/** The person's picture beside their name in the sidebar: synced from the Cloud account, never chosen here. */
function ProfilePhoto() {
  const { state } = useStore();
  const avatarUrl = state.config?.profile?.avatarUrl ?? "";
  return (
    <div className="flex items-center gap-3">
      {avatarUrl ? <img src={avatarUrl} alt="" className="size-12 rounded-full object-cover" /> : <div className="size-12 rounded-full bg-raised" />}
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">{t("settings.profile.avatar.label")}</div>
        <div className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">{t("settings.profile.avatar.synced")}</div>
      </div>
    </div>
  );
}

export function ProfileFields() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState(state.config?.profile?.name ?? "");
  const [email, setEmail] = useState(state.config?.profile?.email ?? "");
  useEffect(() => {
    setName(state.config?.profile?.name ?? "");
    setEmail(state.config?.profile?.email ?? "");
  }, [state.config?.profile?.name, state.config?.profile?.email]);

  const team = Boolean(state.config?.team);
  const save = () => {
    if (team) {
      void saveTeamProfile({ name: name.trim() })
        .then((profile) => dispatch({ type: "profileSaved", profile: { name: profile.name, email: profile.email } }))
        .catch(() => {});
      return;
    }
    void fetch("/api/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: { name: name.trim(), email: email.trim().toLowerCase() } }),
    })
      .then((r) => { if (!r.ok) throw new Error("Profile save failed"); return r.json(); })
      .then((config: ConfigStatus) => {
        if (config.profile) dispatch({ type: "profileSaved", profile: { name: config.profile.name, email: config.profile.email } });
      })
      .catch(() => {});
  };

  const inputClass =
    "w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[14px] text-ink placeholder:text-ink-secondary focus:outline-none";
  return (
    <div className="flex flex-col gap-3">
      <ProfilePhoto />
      <input aria-label={t("settings.profile.name")} value={name} onChange={(e) => setName(e.target.value)} onBlur={save} placeholder={t("settings.profile.name")} className={inputClass} />
      <input
        type="email"
        aria-label={t("phone.signIn.email")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={team ? undefined : save}
        readOnly={team}
        placeholder="you@example.com"
        className={inputClass}
      />
      <AboutMeSettings />
    </div>
  );
}

function ProfileAvatar({ profile }: { profile?: { name?: string; email?: string; avatarUrl?: string } }) {
  const [failed, setFailed] = useState<string | null>(null);
  const initials = profileInitials(profile);
  const photo = profile?.avatarUrl && failed !== profile.avatarUrl ? profile.avatarUrl : null;
  return (
    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink/[0.06] text-[15px] font-medium text-ink-secondary">
      {photo ? <img src={photo} alt="" onError={() => setFailed(photo)} className="size-full object-cover" />
        : initials !== "?" ? initials : <User size={20} aria-hidden="true" />}
    </span>
  );
}

export function ProfileSummaryRow() {
  const { state } = useStore();
  const [editing, setEditing] = useState(false);
  const profile = state.config?.profile;
  const name = profile?.name?.trim() ?? "";
  const email = profile?.email?.trim() ?? "";
  const fieldsId = useId();
  const fields = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editing) fields.current?.querySelector<HTMLInputElement>("input:not([type=file])")?.focus();
  }, [editing]);
  return (
    <div data-profile-summary="" className="px-4 py-[13px]">
      <div className="flex min-w-0 items-center gap-3">
        <ProfileAvatar profile={profile} />
        <div className="min-w-0 flex-1">
          {name || email ? <>
            <div className="truncate text-[14px] leading-5 text-ink">{name || email}</div>
            {name && email && <div className="truncate text-[13px] leading-[18px] text-ink-secondary">{email}</div>}
          </> : <div className="truncate text-[14px] leading-5 text-ink-secondary">{t("settings.simple.account.noName")}</div>}
        </div>
        <button type="button" aria-expanded={editing} aria-controls={fieldsId} className="ui-button shrink-0" onClick={() => setEditing(!editing)}>
          {editing ? t("common.done") : t(name || email ? "settings.simple.account.edit" : "settings.simple.account.add")}
        </button>
      </div>
      <div id={fieldsId} ref={fields} hidden={!editing} className="mt-4">
        {editing && <ProfileFields />}
      </div>
    </div>
  );
}
