export function getOrCreateGuestDeviceUuid(): string {
  let uuid = localStorage.getItem('guest_device_uuid');
  if (!uuid) {
    uuid = 'gdev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    localStorage.setItem('guest_device_uuid', uuid);
  }
  return uuid;
}

export interface GuestLockedIdentity {
  name: string;
  grade: string;
  section: string;
  schoolName?: string;
  branch?: string;
  guestDeviceUuid: string;
}

export function getGuestLockedIdentity(): GuestLockedIdentity | null {
  try {
    const raw = localStorage.getItem('guest_locked_identity');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.name && parsed.guestDeviceUuid) {
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse guest locked identity:', e);
  }
  return null;
}

export function saveGuestLockedIdentity(identity: GuestLockedIdentity): void {
  try {
    localStorage.setItem('guest_locked_identity', JSON.stringify(identity));
  } catch (e) {
    console.warn('Failed to save guest locked identity:', e);
  }
}
