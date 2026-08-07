import apiClient from './apiClient';
import { RosterUser, SupervisedSchool, LicenseLog } from '../types';
import { normalizeDigits, generateDeterministicUserId } from '../utils/helpers';

export { normalizeDigits, generateDeterministicUserId };

export const fetchAllSubmissions = async () => {
  const res = await apiClient.get('/admin/submissions/all');
  return res.data?.data || [];
};

export const fetchAllRosterUsers = async (schoolName?: string, forceRefresh?: boolean) => {
  const res = await apiClient.get('/admin/users', { params: { schoolName, forceRefresh } });
  return res.data?.data || [];
};

export const syncRosterToFirebase = async (users: RosterUser[]) => {
  const res = await apiClient.post('/roster/sync', { users });
  return res.data;
};

export const subscribeToRoster = (callback: (roster: RosterUser[]) => void, filters?: any) => {
  // Mock realtime subscription
  fetchAllRosterUsers().then(callback);
  return () => {};
};

export const subscribeToSubmissions = (callback: (subs: any[]) => void) => {
  fetchAllSubmissions().then(callback);
  return () => {};
};

export const auth = {
  currentUser: null,
  signOut: async () => {},
};

export const saveSingleRosterUserToFirebase = async (user: RosterUser) => {
  const res = await apiClient.post('/admin/users', user);
  return res.data;
};

export const deleteRosterUserFromFirebase = async (id: string) => {
  const res = await apiClient.delete(`/admin/users/${id}`);
  return res.data;
};

export const saveSchoolToFirebase = async (school: SupervisedSchool) => {
  const res = await apiClient.post('/admin/schools', school);
  return res.data;
};

export const deleteSchoolFromFirebase = async (id: string) => {
  const res = await apiClient.delete(`/admin/schools/${id}`);
  return res.data;
};

export const fetchAllSchools = async () => {
  const res = await apiClient.get('/admin/schools/all');
  return res.data?.data || [];
};

export const subscribeToSchools = (callback: (schools: SupervisedSchool[]) => void) => {
  // Mock realtime subscription by fetching once
  fetchAllSchools().then(callback);
  return () => {}; // unsubscribe function
};

export const getSchoolSlug = (schoolName: string, branch: string) => {
  return `${schoolName}_${branch}`.replace(/\s+/g, '_');
};

export const getSchoolUsersBySlug = async (slug: string) => {
  const res = await apiClient.get(`/admin/schools/${slug}/users`);
  return res.data?.data || [];
};

export const searchUsersGlobal = async (searchTerm: string) => {
  const res = await apiClient.get(`/admin/users/search?q=${encodeURIComponent(searchTerm)}`);
  return res.data?.data || [];
};

export const transferUserToSchool = async (userId: string, newSchoolName: string, newBranch: string) => {
  const res = await apiClient.post(`/admin/users/${userId}/transfer`, { schoolName: newSchoolName, branch: newBranch });
  return res.data;
};

export const migrateOldUsersToSubCollections = async () => {
  const res = await apiClient.post('/admin/migrate-users');
  return res.data;
};

export const logLicenseAction = async (action: any) => {
  const res = await apiClient.post('/admin/license-logs', action);
  return res.data;
};

export const fetchLicenseLogs = async () => {
  const res = await apiClient.get('/admin/license-logs');
  return res.data?.data || [];
};

export const archiveSchoolInFirebase = async (id: string, isArchived: boolean) => {
  const res = await apiClient.post(`/admin/schools/${id}/archive`, { isArchived });
  return res.data;
};

export const findUserAndSchoolBySerial = async (serial: string) => {
  const res = await apiClient.get(`/admin/users/by-serial/${serial}`);
  return res.data?.data || null;
};

export const fetchSchoolsPaginated = async (lastVisible: any, limitCount: number = 20) => {
  const res = await apiClient.get(`/admin/schools/paginated?limit=${limitCount}&offset=${lastVisible || 0}`);
  return {
    schools: res.data?.data || [],
    lastVisible: (lastVisible || 0) + limitCount,
  };
};

export const fetchRosterPaginated = async (lastVisible: any, limitCount: number = 20) => {
  const res = await apiClient.get(`/admin/users/paginated?limit=${limitCount}&offset=${lastVisible || 0}`);
  return {
    users: res.data?.data || [],
    lastVisible: (lastVisible || 0) + limitCount,
  };
};

export const getSchoolsCount = async () => {
  const res = await apiClient.get('/admin/schools/count');
  return res.data?.count || 0;
};

export const getRosterCount = async () => {
  const res = await apiClient.get('/admin/users/count');
  return res.data?.count || 0;
};
