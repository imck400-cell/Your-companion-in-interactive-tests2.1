import fs from 'fs';
let content = fs.readFileSync('src/components/TeacherDashboard/RosterManager.tsx', 'utf8');

content = content.replace(
  `import React, { useState, useRef } from 'react';`,
  `import React, { useState, useRef } from 'react';\nimport { deleteRosterUserFromFirebase } from '../../services/firebase';`
);

const confirmDeleteTarget = `  const confirmDelete = () => {
    if (deleteConfirmState.type === 'single' && deleteConfirmState.id) {
      onUpdateRoster(roster.filter((u) => u.id !== deleteConfirmState.id));
    } else if (deleteConfirmState.type === 'multiple') {
      const nextRoster = roster.filter((u) => !selectedIds.has(u.id));
      onUpdateRoster(nextRoster);
      setSelectedIds(new Set());
    }
    setDeleteConfirmState({ isOpen: false, type: 'multiple' });
  };`;

const confirmDeleteReplace = `  const confirmDelete = () => {
    if (deleteConfirmState.type === 'single' && deleteConfirmState.id) {
      const idToDelete = deleteConfirmState.id;
      onUpdateRoster(roster.filter((u) => u.id !== idToDelete));
      deleteRosterUserFromFirebase(idToDelete);
    } else if (deleteConfirmState.type === 'multiple') {
      const nextRoster = roster.filter((u) => !selectedIds.has(u.id));
      onUpdateRoster(nextRoster);
      selectedIds.forEach(id => deleteRosterUserFromFirebase(id));
      setSelectedIds(new Set());
    }
    setDeleteConfirmState({ isOpen: false, type: 'multiple' });
  };`;

content = content.replace(confirmDeleteTarget, confirmDeleteReplace);
fs.writeFileSync('src/components/TeacherDashboard/RosterManager.tsx', content);
