// CatalogManager.jsx
// A single-page CRUD manager for Category, Size, and Generation
// - TailwindCSS for styling
// - Pure React (no external UI deps)
// - Works with your existing API wrappers: client/src/api/Category.jsx, Size.jsx, Generation.jsx
//   Each should export: create*, list*, remove*, and update* (update shown inline below)

import React, { useEffect, useMemo, useState } from "react";
import {
  createCategory,
  listCategory,
  removeCategory,
} from "../api/Category";
import { createSize, listSize, removeSize } from "../api/Size";
import {
  createGeneration,
  listGeneration,
  removeGeneration,
} from "../api/Generation";
import axios from "axios";

/**
 * --- Helper: Update endpoints ---
 * Add simple update functions to mirror your controller's PUT /:id
 */
const updateCategory = (token, id, form) =>
  axios.put(`http://localhost:5001/api/category/${id}`, form, {
    headers: { Authorization: `Bearer ${token}` },
  });
const updateSize = (token, id, form) =>
  axios.put(`http://localhost:5001/api/size/${id}`, form, {
    headers: { Authorization: `Bearer ${token}` },
  });
const updateGeneration = (token, id, form) =>
  axios.put(`http://localhost:5001/api/generation/${id}`, form, {
    headers: { Authorization: `Bearer ${token}` },
  });

/**
 * Generic CRUD table for simple { id, name } resources
 */
function CrudTable({
  title,
  token,
  listFn,
  createFn,
  updateFn,
  deleteFn,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null); // { id, name }

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    return items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));
  }, [items, query]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listFn();
      // Support either array or { data: [], total, ... }
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setItems(data);
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      await createFn(token, { name: name.trim() });
      setName("");
      await load();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || "Create failed");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (row) => setEditing({ id: row.id, name: row.name });
  const cancelEdit = () => setEditing(null);

  const submitEdit = async () => {
    if (!editing?.name?.trim()) return;
    setLoading(true);
    setError("");
    try {
      await updateFn(token, editing.id, { name: editing.name.trim() });
      setEditing(null);
      await load();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete ${title} #${id}?`)) return;
    setLoading(true);
    setError("");
    try {
      await deleteFn(token, id);
      await load();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex gap-2">
          <input
            placeholder="Search name..."
            className="border rounded-lg px-3 py-2 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={load}
            className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Create */}
      <div className="bg-white border rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex gap-2 items-center">
          <input
            placeholder={`New ${title} name`}
            className="border rounded-lg px-3 py-2 text-sm flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-50"
            disabled={loading}
          >
            Add
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 w-20">ID</th>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-right px-4 py-2 w-48">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-2 align-middle">{row.id}</td>
                <td className="px-4 py-2 align-middle">
                  {editing?.id === row.id ? (
                    <input
                      className="border rounded-lg px-3 py-2 text-sm w-full"
                      value={editing.name}
                      onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))}
                    />
                  ) : (
                    row.name
                  )}
                </td>
                <td className="px-4 py-2 align-middle text-right">
                  {editing?.id === row.id ? (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={submitEdit}
                        className="px-3 py-1.5 rounded-lg bg-black text-white text-xs"
                        disabled={loading}
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 rounded-lg border text-xs"
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => startEdit(row)}
                        className="px-3 py-1.5 rounded-lg border text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs"
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="mt-3 text-sm text-red-600 border border-red-200 bg-red-50 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * Main page with tabs for Category, Size, Generation
 */
export default function CatalogManager({ token }) {
  const [tab, setTab] = useState("Category");
  const tabs = ["Category", "Size", "Generation"];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Catalog Manager</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "px-4 py-2 rounded-xl border text-sm " +
              (tab === t ? "bg-black text-white" : "bg-white hover:bg-gray-50")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Category" && (
        <CrudTable
          title="Category"
          token={token}
          listFn={listCategory}
          createFn={createCategory}
          updateFn={updateCategory}
          deleteFn={removeCategory}
        />
      )}

      {tab === "Size" && (
        <CrudTable
          title="Size"
          token={token}
          listFn={listSize}
          createFn={createSize}
          updateFn={updateSize}
          deleteFn={removeSize}
        />
      )}

      {tab === "Generation" && (
        <CrudTable
          title="Generation"
          token={token}
          listFn={listGeneration}
          createFn={createGeneration}
          updateFn={updateGeneration}
          deleteFn={removeGeneration}
        />
      )}

      <div className="mt-8 text-xs text-gray-500">
        <p>
          Tips: The list supports local search. Server responses can be an array
          or an object like <code>{`{ data: [], total: 0 }`}</code>.
        </p>
      </div>
    </div>
  );
}
