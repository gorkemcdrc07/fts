import React from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import "./Layout.css"; // Ek stil dosyası eklendi

function Layout({ children }) {
    return (
        <>
            <Navbar />
            <Sidebar />
            <main className="main-content">
                {children}
            </main>
        </>
    );
}

export default Layout;
