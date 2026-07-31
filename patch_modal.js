import fs from 'fs';

let content = fs.readFileSync('src/components/TeacherDashboard/RosterManager.tsx', 'utf8');

const importTarget = `import React, { useState, useRef } from 'react';`;
const importReplace = `import React, { useState, useRef } from 'react';`;

// I don't need to change imports if it's already there. Let's find state declarations.
const stateTarget = `  // Print ID Cards Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);`;

const stateReplace = `  // Print ID Cards Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Delete Confirmation Modal State
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    type: 'single' | 'multiple';
    id?: string;
    name?: string;
  }>({ isOpen: false, type: 'multiple' });`;

content = content.replace(stateTarget, stateReplace);


const deleteUserTarget = `  const handleDeleteUser = (id: string, name: string) => {
    if (confirm(\`هل أنت متأكد من حذف الحساب الخاص بـ (\${name})؟\`)) {
      onUpdateRoster(roster.filter((u) => u.id !== id));
    }
  };`;

const deleteUserReplace = `  const handleDeleteUser = (id: string, name: string) => {
    setDeleteConfirmState({ isOpen: true, type: 'single', id, name });
  };`;

content = content.replace(deleteUserTarget, deleteUserReplace);


const deleteSelectedTarget = `  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (confirm(\`هل أنت متأكد من حذف (\${selectedIds.size}) حساب نهائياً؟\`)) {
      const nextRoster = roster.filter((u) => !selectedIds.has(u.id));
      onUpdateRoster(nextRoster);
      setSelectedIds(new Set());
    }
  };`;

const deleteSelectedReplace = `  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirmState({ isOpen: true, type: 'multiple' });
  };

  const confirmDelete = () => {
    if (deleteConfirmState.type === 'single' && deleteConfirmState.id) {
      onUpdateRoster(roster.filter((u) => u.id !== deleteConfirmState.id));
    } else if (deleteConfirmState.type === 'multiple') {
      const nextRoster = roster.filter((u) => !selectedIds.has(u.id));
      onUpdateRoster(nextRoster);
      setSelectedIds(new Set());
    }
    setDeleteConfirmState({ isOpen: false, type: 'multiple' });
  };`;

content = content.replace(deleteSelectedTarget, deleteSelectedReplace);


const modalJsxTarget = `    </div>
  );
};`;

const modalJsxReplace = `
      {/* Delete Confirmation Modal */}
      {deleteConfirmState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden dir-rtl">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 text-center mb-2">تأكيد الحذف</h3>
              <p className="text-sm text-slate-600 text-center mb-6">
                {deleteConfirmState.type === 'single'
                  ? \`هل أنت متأكد من حذف الحساب الخاص بـ (\${deleteConfirmState.name})؟ لا يمكن التراجع عن هذا الإجراء.\`
                  : \`هل أنت متأكد من حذف (\${selectedIds.size}) حساب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.\`}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-all"
                >
                  نعم، حذف
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmState({ isOpen: false, type: 'multiple' })}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-sm transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};`;

content = content.replace(modalJsxTarget, modalJsxReplace);

fs.writeFileSync('src/components/TeacherDashboard/RosterManager.tsx', content);
