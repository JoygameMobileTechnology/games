import type { Profile } from "./profile";
import { exportProfile, MAX_BACKUP_BYTES, readProfileBackup, restoreProfile } from "./profile-transfer";
import "./profile-transfer.css";

export function mountProfileTransfer(host: HTMLElement, profile: Profile, canRestore: () => boolean, onRestore: () => void): () => void {
  host.innerHTML = `<h3>PROFILE BACKUP</h3><p class="setting-note">Save your name, settings, statistics, Favor and cosmetics as a file. Move that file to another device, then restore it here. No account or internet is needed.</p><div class="profile-file-actions"><button type="button" data-export>EXPORT BACKUP</button><label class="profile-file-button">CHOOSE BACKUP<input type="file" accept=".json,application/json" data-import aria-label="Choose Phobos profile backup"/></label></div><div data-preview hidden><p data-summary></p><p class="setting-note">Restoring replaces this browser’s profile. It does not combine balances or records. Export the current profile first if you want to keep it.</p><div class="profile-file-actions"><button type="button" data-restore>RESTORE THIS BACKUP</button><button type="button" data-cancel>CANCEL</button></div></div><p class="setting-note" data-transfer-status role="status" aria-live="polite"></p>`;
  const status = host.querySelector<HTMLElement>("[data-transfer-status]")!;
  const preview = host.querySelector<HTMLElement>("[data-preview]")!;
  const input = host.querySelector<HTMLInputElement>("[data-import]")!;
  const restore = host.querySelector<HTMLButtonElement>("[data-restore]")!;
  let pending: Profile | null = null, generation = 0, disposed = false;
  let downloadUrl: string | null = null;
  host.querySelector<HTMLButtonElement>("[data-export]")!.onclick = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob([exportProfile(profile)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = downloadUrl; link.download = `phobos-profile-${new Date().toISOString().slice(0, 10)}.json`;
    host.append(link); link.click(); link.remove();
    status.textContent = "Backup file prepared. Keep a copy somewhere you can recover if browser data is cleared.";
  };
  input.onchange = async () => {
    const request = ++generation;
    pending = null; preview.hidden = true;
    const file = input.files?.[0];
    if (!file) return;
    status.textContent = "Reading backup…";
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("Choose a Phobos profile file under 4 MB.");
      const candidate = readProfileBackup(await file.text());
      if (disposed || request !== generation) return;
      pending = candidate;
      host.querySelector<HTMLElement>("[data-summary]")!.textContent = `${candidate.name} · ${candidate.cosmetics!.favor.toLocaleString()} Favor · ${candidate.stats.matches.toLocaleString()} completed matches · ${candidate.cosmetics!.owned.length} owned cosmetics`;
      preview.hidden = false;
      restore.disabled = !canRestore();
      status.textContent = canRestore() ? "Review the backup above, then restore when ready." : "Return to the main menu and leave your LAN room before restoring a profile.";
    } catch (error) {
      if (!disposed && request === generation) status.textContent = error instanceof Error ? error.message : "Could not read this backup.";
    }
  };
  host.querySelector<HTMLButtonElement>("[data-cancel]")!.onclick = () => { ++generation; pending = null; input.value = ""; preview.hidden = true; status.textContent = "Restore cancelled. Your profile is unchanged."; };
  restore.onclick = () => {
    if (!pending) return;
    if (!canRestore()) { status.textContent = "Return to the main menu and leave your LAN room before restoring a profile."; return; }
    if (!restoreProfile(profile, pending)) { status.textContent = "The browser could not save the backup. Your current profile is unchanged. Free storage or enable site storage and try again."; return; }
    pending = null; input.value = ""; preview.hidden = true;
    status.textContent = "Profile restored. Your name, settings, statistics and cosmetics are ready.";
    onRestore();
  };
  return () => { disposed = true; generation++; if (downloadUrl) URL.revokeObjectURL(downloadUrl); host.replaceChildren(); };
}
