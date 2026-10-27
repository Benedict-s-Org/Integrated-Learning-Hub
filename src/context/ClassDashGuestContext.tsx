import React, { createContext, useContext, useMemo } from 'react';

export interface ClassDashGuestState {
  isGuest: boolean;
  token?: string;
  targetClass?: string;
  validUntil?: string | null;
  linkId?: string;
}

const defaultState: ClassDashGuestState = { isGuest: false };

const ClassDashGuestContext = createContext<ClassDashGuestState>(defaultState);

export function ClassDashGuestProvider({
  token,
  targetClass,
  validUntil,
  linkId,
  children,
}: {
  token: string;
  targetClass: string;
  validUntil?: string | null;
  linkId?: string;
  children: React.ReactNode;
}) {
  const value = useMemo<ClassDashGuestState>(
    () => ({
      isGuest: true,
      token,
      targetClass,
      validUntil: validUntil ?? null,
      linkId,
    }),
    [token, targetClass, validUntil, linkId],
  );

  return (
    <ClassDashGuestContext.Provider value={value}>
      {children}
    </ClassDashGuestContext.Provider>
  );
}

export function useClassDashGuest(): ClassDashGuestState {
  return useContext(ClassDashGuestContext);
}
