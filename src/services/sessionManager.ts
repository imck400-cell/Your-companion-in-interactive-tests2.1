import { RosterUser, TeacherProfile } from '../types';

export const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // 2 Hours in milliseconds

// Retrieve or generate browser instance unique device session token
export function getOrCreateDeviceSessionToken(): string {
  let token = sessionStorage.getItem('app_device_session_token');
  if (!token) {
    token = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('app_device_session_token', token);
  }
  return token;
}

// Generate random public reference ID (non-sensitive)
export function generatePublicRefId(): string {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `REF-${random}`;
}

// Result structure for session validation
export interface SessionValidationResult {
  allowed: boolean;
  errorMessage?: string;
  updatedUser?: RosterUser;
  updatedTeacher?: TeacherProfile;
}

/**
 * Validates whether user can log in or if another device currently holds an active session (< 2 hours old).
 * Enforces single active session rule ("الاستئصال اللطيف").
 */
export function validateAndAcquireSessionForRosterUser(
  user: RosterUser
): SessionValidationResult {
  if (user.is_suspended) {
    return {
      allowed: false,
      errorMessage: 'تم إيقاف وتعليق هذا الحساب إدارياً من قبل المشرف العام. يرجى التواصل مع إدارة النظام.',
    };
  }

  if (user.is_unauthorized) {
    return {
      allowed: false,
      errorMessage: 'هذا الحساب في حالة (غير مصرح) وبانتظار الموافقة وتحديد تاريخ الانتهاء من المشرف العام.',
    };
  }

  if (user.subscription_end_date) {
    const todayStr = new Date().toISOString().split('T')[0];
    if (user.subscription_end_date < todayStr) {
      return {
        allowed: false,
        errorMessage: 'عفواً، انتهت فترة ترخيص وصلاحية هذا الحساب. يرجى التواصل مع المشرف العام لتمديد الاشتراك.',
      };
    }
  }

  const currentToken = getOrCreateDeviceSessionToken();
  const now = Date.now();

  const activeSessionToken = (user.active_session_id || '').trim();
  const hasActiveSession =
    Boolean(activeSessionToken) &&
    activeSessionToken !== '' &&
    activeSessionToken !== 'none' &&
    Boolean(user.last_activity_at) &&
    user.last_activity_at! > 0 &&
    now - user.last_activity_at! < TWO_HOURS_MS;

  const isDifferentDevice = activeSessionToken !== '' && activeSessionToken !== currentToken;

  if (hasActiveSession && isDifferentDevice) {
    return {
      allowed: false,
      errorMessage:
        'نأسف لإزعاجكم ولكن المستخدم موجود حاليا على جهاز آخر الرجاء إغلاقه من الجهاز الآخر واستخدامه هنا.',
    };
  }

  // Grant session access and bind to current device
  const updatedUser: RosterUser = {
    ...user,
    active_session_id: currentToken,
    last_activity_at: now,
    public_ref_id: user.public_ref_id || generatePublicRefId(),
    subscription_end_date:
      user.subscription_end_date || new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  };

  return {
    allowed: true,
    updatedUser,
  };
}

/**
 * Validates session for Teacher Profile
 */
export function validateAndAcquireSessionForTeacher(
  teacher: TeacherProfile
): SessionValidationResult {
  if (teacher.is_suspended) {
    return {
      allowed: false,
      errorMessage: 'تم إيقاف وتعليق هذا الحساب إدارياً من قبل المشرف العام. يرجى التواصل مع إدارة النظام.',
    };
  }

  if (teacher.is_unauthorized) {
    return {
      allowed: false,
      errorMessage: 'هذا الحساب في حالة (غير مصرح) وبانتظار الموافقة وتحديد تاريخ الانتهاء من المشرف العام.',
    };
  }

  if (teacher.subscription_end_date) {
    const todayStr = new Date().toISOString().split('T')[0];
    if (teacher.subscription_end_date < todayStr) {
      return {
        allowed: false,
        errorMessage: 'عفواً، انتهت فترة ترخيص وصلاحية هذا الحساب. يرجى التواصل مع المشرف العام لتمديد الاشتراك.',
      };
    }
  }

  const currentToken = getOrCreateDeviceSessionToken();
  const now = Date.now();

  const activeSessionToken = (teacher.active_session_id || '').trim();
  const hasActiveSession =
    Boolean(activeSessionToken) &&
    activeSessionToken !== '' &&
    activeSessionToken !== 'none' &&
    Boolean(teacher.last_activity_at) &&
    teacher.last_activity_at! > 0 &&
    now - teacher.last_activity_at! < TWO_HOURS_MS;

  const isDifferentDevice = activeSessionToken !== '' && activeSessionToken !== currentToken;

  if (hasActiveSession && isDifferentDevice) {
    return {
      allowed: false,
      errorMessage:
        'نأسف لإزعاجكم ولكن المستخدم موجود حاليا على جهاز آخر الرجاء إغلاقه من الجهاز الآخر واستخدامه هنا.',
    };
  }

  const updatedTeacher: TeacherProfile = {
    ...teacher,
    active_session_id: currentToken,
    last_activity_at: now,
    public_ref_id: teacher.public_ref_id || generatePublicRefId(),
    subscription_end_date:
      teacher.subscription_end_date || new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  };

  return {
    allowed: true,
    updatedTeacher,
  };
}

/**
 * Update session heartbeat / activity timestamp
 */
export function touchUserSessionActivity(user: RosterUser): RosterUser {
  return {
    ...user,
    last_activity_at: Date.now(),
  };
}

/**
 * Clear session on explicit logout
 */
export function releaseUserSession(user: RosterUser): RosterUser {
  return {
    ...user,
    active_session_id: undefined,
    last_activity_at: undefined,
  };
}
