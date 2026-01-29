export interface ComponentDebugInfo {
  tables?: {
    reads?: string[];
    writes?: string[];
  };
  rpcFunctions?: string[];
  edgeFunctions?: string[];
  actions?: string[];
  description?: string;
}

export const componentRegistry: Record<string, ComponentDebugInfo> = {
  'ProofreadingAssignment': {
    description: 'Admin screen to assign proofreading practices to students',
    tables: {
      reads: ['proofreading_practice_assignments'],
      writes: ['proofreading_practice_assignments'],
    },
    edgeFunctions: ['auth/list-users'],
    actions: [
      'Select students to assign',
      'Bulk assign practice to selected students',
      'Preview practice',
    ],
  },

  'AssignedProofreadingPractices': {
    description: 'Student view of assigned proofreading practices',
    tables: {
      reads: ['proofreading_practice_assignments', 'proofreading_practices'],
    },
    rpcFunctions: ['get_user_assigned_proofreading_practices'],
    actions: [
      'View assignment list',
      'Start practice',
      'Review completed practice',
    ],
  },

  'ProofreadingPractice': {
    description: 'Interactive proofreading exercise screen',
    tables: {
      reads: ['proofreading_practices'],
      writes: ['proofreading_practice_results', 'proofreading_practice_assignments'],
    },
    actions: [
      'Click words to select mistakes',
      'Enter corrections',
      'Check answers',
      'Try again',
    ],
  },

  'AssignmentManagement': {
    description: 'Admin dashboard for all assignment types',
    tables: {
      reads: ['users', 'proofreading_practice_assignments', 'spelling_practice_assignments', 'memorization_assignments'],
    },
    rpcFunctions: ['get_all_assignments_overview', 'get_all_assignments_admin_view'],
    actions: [
      'Filter by type',
      'Filter by status',
      'Filter by student',
      'Sort assignments',
      'Search assignments',
    ],
  },

  'SavedProofreadingPractices': {
    description: 'Admin list of saved proofreading practices',
    tables: {
      reads: ['proofreading_practices'],
    },
    rpcFunctions: ['get_proofreading_assignment_stats'],
    actions: [
      'View practice list',
      'Select practice to assign',
      'Delete practice',
    ],
  },

  'SpellingPractice': {
    description: 'Interactive spelling practice screen',
    tables: {
      writes: ['spelling_practice_results'],
    },
    rpcFunctions: ['mark_assignment_complete'],
    actions: [
      'Listen to word',
      'Type spelling',
      'Check answer',
      'Next word',
    ],
  },

  'MemorizationView': {
    description: 'Memorization practice screen',
    tables: {
      writes: ['memorization_practice_sessions'],
    },
    rpcFunctions: ['mark_assignment_complete'],
    actions: [
      'View content',
      'Practice recitation',
      'Mark complete',
    ],
  },

  'UnifiedAssignments': {
    description: 'Student view of all assignment types',
    rpcFunctions: ['get_student_assignments_unified'],
    actions: [
      'View all assignments',
      'Start assignment',
      'Filter by type',
    ],
  },

  'UserAnalytics': {
    description: 'Admin analytics dashboard',
    rpcFunctions: [
      'get_class_analytics_summary',
      'get_all_students_performance',
      'get_practice_activity_timeline',
      'get_recent_activity',
      'get_performance_distribution',
    ],
    actions: [
      'View class summary',
      'View student performance',
      'View activity timeline',
    ],
  },

  'StudentProgress': {
    description: 'Student progress and rankings view',
    rpcFunctions: [
      'get_user_progress_summary',
      'get_spelling_rankings',
      'get_proofreading_rankings',
    ],
    actions: [
      'View personal progress',
      'View rankings',
    ],
  },

  'AssignedMemorizations': {
    description: 'Student view of assigned memorizations',
    rpcFunctions: ['get_user_assigned_memorizations'],
    actions: [
      'View memorization list',
      'Start memorization',
    ],
  },

  'AuthForm': {
    description: 'Login and registration form',
    edgeFunctions: ['auth/login', 'auth/register'],
    actions: [
      'Enter username/password',
      'Login',
      'Register (admin only)',
    ],
  },

  'AdminPanel': {
    description: 'Admin user management panel',
    edgeFunctions: ['auth/list-users', 'auth/create-user', 'auth/delete-user'],
    tables: {
      reads: ['users'],
    },
    actions: [
      'View users',
      'Create user',
      'Delete user',
      'Change permissions',
    ],
  },
};

export function getComponentDebugInfo(componentName: string): ComponentDebugInfo | null {
  const baseComponentName = componentName.split(' ')[0];
  return componentRegistry[baseComponentName] || null;
}
