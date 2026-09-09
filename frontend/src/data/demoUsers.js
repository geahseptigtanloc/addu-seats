export const DEMO_USERS = {
  student: {
    userId: '11111111-1111-1111-1111-111111111111',
    role: 'student',
    name: 'Alex Student',
    email: 'student.demo@addu.edu.ph',
    adduIdLast4: '2026',
  },
  admin: {
    userId: '22222222-2222-2222-2222-222222222222',
    role: 'admin',
    name: 'Morgan Admin',
    email: 'admin.demo@addu.edu.ph',
    adduIdLast4: '0001',
  },
};

export function getDemoUser(role) {
  const user = DEMO_USERS[role];
  return user ? { ...user } : null;
}
