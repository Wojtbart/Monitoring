import React, { createContext, useContext } from "react";
const AdminContext = createContext();
export const useAdmin = () => {
    return useContext(AdminContext);
};
export const AdminProvider = ({ children, isAdmin }) => {
    return (
        <AdminContext.Provider value={isAdmin}>
            {children}
        </AdminContext.Provider>
    );
};
