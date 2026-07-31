const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

const additionalStates = `
  // --- Phase 1 Pagination States ---
  const [schoolsLastDoc, setSchoolsLastDoc] = useState<any>(null);
  const [hasMoreSchools, setHasMoreSchools] = useState(true);
  const [isFetchingSchools, setIsFetchingSchools] = useState(false);
  const [totalSchoolsCount, setTotalSchoolsCount] = useState<number | null>(null);

  const [usersLastDoc, setUsersLastDoc] = useState<any>(null);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [totalUsersCount, setTotalUsersCount] = useState<number | null>(null);

  const [staffLastDoc, setStaffLastDoc] = useState<any>(null);
  const [hasMoreStaff, setHasMoreStaff] = useState(true);
  const [isFetchingStaff, setIsFetchingStaff] = useState(false);
  const [totalStaffCount, setTotalStaffCount] = useState<number | null>(null);

  const loadSchoolsPage = async (isLoadMore = false) => {
    setIsFetchingSchools(true);
    if (!isLoadMore) {
      const cnt = await getSchoolsCount();
      setTotalSchoolsCount(cnt);
    }
    const { schools: newSchools, lastDoc } = await fetchSchoolsPaginated(isLoadMore ? schoolsLastDoc : null, 15);
    setSchools(prev => isLoadMore ? [...prev, ...newSchools] : newSchools);
    setSchoolsLastDoc(lastDoc);
    setHasMoreSchools(!!lastDoc);
    setIsFetchingSchools(false);
  };

  const loadUsersPage = async (isLoadMore = false) => {
    setIsFetchingUsers(true);
    if (!isLoadMore) {
      const cnt = await getRosterCount('student', selectedMasterSchoolSlug !== 'all' ? selectedMasterSchoolSlug : undefined);
      setTotalUsersCount(cnt);
    }
    const { users: newUsers, lastDoc } = await fetchRosterPaginated('student', selectedMasterSchoolSlug !== 'all' ? selectedMasterSchoolSlug : undefined, isLoadMore ? usersLastDoc : null, 15);
    
    // We update localRoster with the paginated users, but carefully. 
    // Wait, the UI might be mapped to localRoster or isolatedSchoolUsers. Let's merge them into localRoster for display.
    setLocalRoster(prev => {
      const existing = isLoadMore ? prev : [];
      const mergedMap = new Map(existing.map(u => [u.id, u]));
      newUsers.forEach(u => mergedMap.set(u.id, u));
      return Array.from(mergedMap.values());
    });
    
    setUsersLastDoc(lastDoc);
    setHasMoreUsers(!!lastDoc);
    setIsFetchingUsers(false);
  };

  const loadStaffPage = async (isLoadMore = false) => {
    setIsFetchingStaff(true);
    if (!isLoadMore) {
      const cnt = await getRosterCount('teacher', selectedMasterSchoolSlug !== 'all' ? selectedMasterSchoolSlug : undefined);
      setTotalStaffCount(cnt);
    }
    const { users: newStaff, lastDoc } = await fetchRosterPaginated('teacher', selectedMasterSchoolSlug !== 'all' ? selectedMasterSchoolSlug : undefined, isLoadMore ? staffLastDoc : null, 15);
    
    setLocalRoster(prev => {
      // we only replace teachers or we can just keep them separated. 
      // Actually AdminDashboard filters localRoster by role. So we can just merge.
      const existing = isLoadMore ? prev : prev.filter(u => u.role !== 'teacher');
      const mergedMap = new Map(existing.map(u => [u.id, u]));
      newStaff.forEach(u => mergedMap.set(u.id, u));
      return Array.from(mergedMap.values());
    });

    setStaffLastDoc(lastDoc);
    setHasMoreStaff(!!lastDoc);
    setIsFetchingStaff(false);
  };
`;

code = code.replace("  // Toast feedback message", additionalStates + "\n  // Toast feedback message");
fs.writeFileSync('src/components/AdminDashboard.tsx', code);
