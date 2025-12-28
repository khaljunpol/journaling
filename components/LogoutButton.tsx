"use client";

export default function LogoutButton() {
  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  return (
    <button className="rounded-md border px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={logout}>
      Logout
    </button>
  );
}
