import { createClient } from "@supabase/supabase-js";
import { STORAGE_KEYS } from "../constants";
const getEnv = (name) => {
  try {
    if (typeof process !== "undefined" && process.env && process.env[name]) {
      return process.env[name];
    }
    const metaEnv = import.meta.env;
    if (metaEnv && metaEnv[name]) {
      return metaEnv[name];
    }
  } catch (e) {
  }
  return "";
};
const SUPABASE_URL = getEnv("VITE_SUPABASE_URL") || "https://placeholder-project.supabase.co";
const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY") || "placeholder-anon-key";
const APP_SECRET = "work-tracker-pro-secret-2026";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    headers: {
      "x-app-token": APP_SECRET
    }
  }
});
const isConfigured = () => {
  const configured = SUPABASE_URL !== "https://placeholder-project.supabase.co" && SUPABASE_ANON_KEY !== "placeholder-anon-key" && SUPABASE_URL.trim() !== "" && SUPABASE_ANON_KEY.trim() !== "";
  return configured;
};
let _isConfigured = null;
const checkConfig = () => {
  if (_isConfigured === null) _isConfigured = isConfigured();
  return _isConfigured;
};
const cleanValue = (val) => {
  if (val === null || val === void 0) return val;
  if (typeof val === "string") {
    const cleaned = val.trim().replace(/^[^a-zA-Z0-9]+/, "");
    return cleaned;
  }
  return val;
};
const db = {
  isConfigured: checkConfig,
  checkConnection: async () => {
    if (!checkConfig()) return false;
    try {
      const { data, error } = await supabase.from("organizations").select("id").limit(1);
      return !error;
    } catch (e) {
      return false;
    }
  },
  getAuditLogs: async (orgId) => {
    if (!checkConfig()) return null;
    const { data, error } = await supabase.from("audit_logs").select("*").eq("organization_id", orgId).order("timestamp", { ascending: false }).limit(1e3);
    if (error) {
      console.error("Error fetching audit logs:", error);
      return null;
    }
    return (data || []).map((l) => ({
      id: l.id,
      orgId: l.organization_id,
      timestamp: l.timestamp,
      adminId: l.admin_id,
      adminName: l.admin_name,
      action: l.action,
      details: l.details,
      changes: l.changes,
      targetUserId: l.target_user_id,
      targetUserName: l.target_user_name
    }));
  },
  saveAuditLog: async (log) => {
    if (!isConfigured()) return { error: "Not configured" };
    const { error } = await supabase.from("audit_logs").insert({
      id: log.id,
      organization_id: log.orgId,
      timestamp: log.timestamp,
      admin_id: log.adminId,
      admin_name: log.adminName,
      action: log.action,
      details: log.details,
      changes: log.changes,
      target_user_id: log.targetUserId,
      target_user_name: log.targetUserName
    });
    return { error };
  },
  getOrganization: async (orgId) => {
    if (!checkConfig()) {
      const cached = localStorage.getItem(STORAGE_KEYS.ORG_DATA);
      if (cached) {
        const org = JSON.parse(cached);
        if (org.id === orgId) return org;
      }
      return null;
    }
    const { data, error } = await supabase.from("organizations").select("*").eq("id", orgId).maybeSingle();
    if (error || !data) {
      const cached = localStorage.getItem(STORAGE_KEYS.ORG_DATA);
      if (cached) {
        const org = JSON.parse(cached);
        if (org.id === orgId) return org;
      }
      return null;
    }
    return {
      ...data,
      ownerId: data.owner_id,
      expiryDate: data.expiry_date,
      notificationSettings: data.notification_settings,
      locationSettings: data.location_settings || data.notification_settings?.locationSettings,
      telegramSettings: data.telegram_settings || data.notification_settings?.telegramSettings,
      maxShiftDuration: data.max_shift_duration,
      roundShiftMinutes: data.round_shift_minutes,
      nightShiftBonus: data.night_shift_bonus,
      createdAt: data.created_at
    };
  },
  getLogs: async (orgId, monthPrefix) => {
    if (!checkConfig()) return null;
    try {
      let query = supabase.from("work_logs").select("*");
      if (orgId === "demo_org") {
        query = query.or("organization_id.eq.demo_org,organization_id.is.null,organization_id.eq.");
      } else {
        query = query.eq("organization_id", orgId);
      }
      query = query.order("date", { ascending: false }).order("check_in", { ascending: false });
      if (monthPrefix) {
        const startDate = `${monthPrefix}-01`;
        const [year, month] = monthPrefix.split("-");
        const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
        const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`;
        query = query.gte("date", startDate).lt("date", endDate);
      } else {
        query = query.limit(1e3);
      }
      const { data, error } = await query;
      if (error) {
        if (error.code === "42703" || error.code === "PGRST204" || error.message?.includes("column")) {
          console.warn("organization_id column missing in work_logs, fetching all logs");
          const { data: allData, error: allError } = await supabase.from("work_logs").select("*").order("date", { ascending: false }).limit(1e3);
          if (allError) throw allError;
          return (allData || []).map((l) => ({
            id: cleanValue(l.id),
            userId: cleanValue(l.user_id),
            organizationId: cleanValue(l.organization_id),
            date: cleanValue(l.date),
            entryType: l.entry_type,
            machineId: cleanValue(l.machine_id),
            checkIn: cleanValue(l.check_in),
            checkOut: cleanValue(l.check_out),
            durationMinutes: l.duration_minutes,
            photoIn: l.photo_in,
            photoOut: l.photo_out,
            isCorrected: l.is_corrected,
            correctionNote: l.correction_note,
            correctionTimestamp: l.correction_timestamp,
            isNightShift: l.is_night_shift,
            fine: l.fine,
            bonus: l.bonus,
            itemsProduced: l.items_produced
          }));
        }
        throw error;
      }
      return (data || []).map((l) => ({
        id: cleanValue(l.id),
        userId: cleanValue(l.user_id),
        organizationId: cleanValue(l.organization_id),
        branchId: cleanValue(l.branch_id),
        date: cleanValue(l.date),
        entryType: l.entry_type,
        machineId: cleanValue(l.machine_id),
        checkIn: cleanValue(l.check_in),
        checkOut: cleanValue(l.check_out),
        durationMinutes: l.duration_minutes,
        photoIn: l.photo_in,
        photoOut: l.photo_out,
        isCorrected: l.is_corrected,
        correctionNote: l.correction_note,
        correctionTimestamp: l.correction_timestamp,
        isNightShift: l.is_night_shift,
        fine: l.fine,
        bonus: l.bonus,
        itemsProduced: l.items_produced
      }));
    } catch (e) {
      console.error("Error in getLogs:", e);
      return null;
    }
  },
  getRecentLogs: async (orgId, days = 2) => {
    if (!checkConfig()) return null;
    try {
      const now = /* @__PURE__ */ new Date();
      now.setDate(now.getDate() - days);
      const startDate = now.toISOString().split("T")[0];
      let query = supabase.from("work_logs").select("*");
      if (orgId === "demo_org") {
        query = query.or("organization_id.eq.demo_org,organization_id.is.null,organization_id.eq.");
      } else {
        query = query.eq("organization_id", orgId);
      }
      query = query.gte("date", startDate).order("date", { ascending: false }).order("check_in", { ascending: false });
      const { data, error } = await query;
      if (error) {
        console.error("Error fetching recent logs:", error);
        return null;
      }
      return (data || []).map((l) => ({
        id: cleanValue(l.id),
        userId: cleanValue(l.user_id),
        organizationId: cleanValue(l.organization_id),
        branchId: cleanValue(l.branch_id),
        date: cleanValue(l.date),
        entryType: cleanValue(l.entry_type),
        machineId: cleanValue(l.machine_id),
        checkIn: cleanValue(l.check_in),
        checkOut: cleanValue(l.check_out),
        durationMinutes: l.duration_minutes,
        photoIn: cleanValue(l.photo_in),
        photoOut: cleanValue(l.photo_out),
        isCorrected: l.is_corrected,
        correctionNote: cleanValue(l.correction_note),
        correctionTimestamp: cleanValue(l.correction_timestamp),
        isNightShift: l.is_night_shift,
        fine: l.fine,
        bonus: l.bonus,
        itemsProduced: l.items_produced,
        location: l.location
      }));
    } catch (e) {
      console.error("Error in getRecentLogs:", e);
      return null;
    }
  },
  upsertLog: async (log, orgId) => {
    if (!isConfigured()) return;
    console.log("\u{1F4DD} Upserting log:", log.id, "Org:", orgId);
    const payload = {
      id: log.id,
      user_id: log.userId,
      organization_id: orgId,
      branch_id: log.branchId,
      date: log.date,
      entry_type: log.entryType,
      machine_id: log.machineId,
      check_in: log.checkIn,
      check_out: log.checkOut,
      duration_minutes: log.durationMinutes,
      photo_in: log.photoIn,
      photo_out: log.photoOut,
      is_corrected: log.isCorrected,
      correction_note: log.correctionNote,
      correction_timestamp: log.correctionTimestamp,
      is_night_shift: log.isNightShift,
      fine: log.fine,
      bonus: log.bonus,
      items_produced: log.itemsProduced,
      location: log.location
    };
    const { error } = await supabase.from("work_logs").upsert(payload);
    if (error) {
      console.error("\u274C Error upserting log:", error);
      if (error.code === "42703" || error.code === "PGRST204" || error.message?.includes("column")) {
        const { is_night_shift, photo_in, photo_out, machine_id, fine, bonus, items_produced, location, branch_id, ...minimalPayload } = payload;
        await supabase.from("work_logs").upsert(minimalPayload);
      }
    } else {
      console.log("\u2705 Log upserted successfully");
    }
  },
  getDashboardStats: async (orgId, monthPrefix, last7Days) => {
    if (!checkConfig()) return null;
    try {
      const { data, error } = await supabase.rpc("get_dashboard_stats", {
        p_org_id: orgId,
        p_month: monthPrefix,
        p_last_7_days: last7Days
      });
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn("RPC get_dashboard_stats failed, falling back to local calculation", e);
      return null;
    }
  },
  uploadPhoto: async (base64Data, orgId, userId) => {
    if (!isConfigured() || !base64Data.startsWith("data:image")) return base64Data;
    try {
      const base64Parts = base64Data.split(",");
      if (base64Parts.length !== 2) return base64Data;
      const mimeMatch = base64Parts[0].match(/:(.*?);/);
      if (!mimeMatch) return base64Data;
      const mimeType = mimeMatch[1];
      const byteCharacters = atob(base64Parts[1]);
      const byteArrays = [];
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      const blob = new Blob(byteArrays, { type: mimeType });
      const fileExt = mimeType.split("/")[1] || "jpg";
      const fileName = `${orgId}/${userId}/${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from("photos").upload(fileName, blob, {
        cacheControl: "31536000",
        upsert: false
      });
      if (error) {
        console.error("Error uploading photo:", error);
        return base64Data;
      }
      const { data: publicUrlData } = supabase.storage.from("photos").getPublicUrl(fileName);
      return publicUrlData.publicUrl;
    } catch (e) {
      console.error("Exception uploading photo:", e);
      return base64Data;
    }
  },
  batchUpsertLogs: async (logs, orgId) => {
    if (!isConfigured() || logs.length === 0) return { error: null };
    const payload = logs.map((log) => {
      const item = {
        id: log.id,
        user_id: log.userId,
        date: log.date,
        entry_type: log.entryType,
        check_in: log.checkIn,
        check_out: log.checkOut || null,
        duration_minutes: log.durationMinutes || 0,
        machine_id: log.machineId || null,
        photo_in: log.photoIn || null,
        photo_out: log.photoOut || null,
        is_corrected: log.isCorrected || false,
        correction_note: log.correctionNote || null,
        correction_timestamp: log.correctionTimestamp || null,
        is_night_shift: log.isNightShift || false,
        fine: log.fine || 0,
        bonus: log.bonus || 0,
        items_produced: log.itemsProduced !== void 0 ? log.itemsProduced : null,
        location: log.location || null,
        branch_id: log.branchId || null,
        organization_id: orgId
      };
      return item;
    });
    const { error } = await supabase.from("work_logs").upsert(payload);
    if (error) {
      console.error("Error batch upserting logs:", error);
      if (error.code === "42703" || error.code === "PGRST204" || error.message?.includes("column")) {
        const minimalPayload = payload.map((p) => {
          const { is_night_shift, photo_in, photo_out, machine_id, fine, bonus, items_produced, location, branch_id, ...rest } = p;
          return rest;
        });
        console.warn("Retrying with minimal payload...");
        const { error: retryError } = await supabase.from("work_logs").upsert(minimalPayload);
        return { error: retryError };
      }
      if (error.code === "22001" || error.message?.includes("too long")) {
        const noPhotoPayload = payload.map((p) => {
          const { photo_in, photo_out, ...rest } = p;
          return rest;
        });
        console.warn("Retrying without photos...");
        const { error: retryError } = await supabase.from("work_logs").upsert(noPhotoPayload);
        return { error: retryError };
      }
    }
    return { error };
  },
  deleteLog: async (id, orgId) => {
    if (!isConfigured()) return;
    let query = supabase.from("work_logs").delete().eq("id", id);
    if (orgId === "demo_org") {
      query = query.or(`organization_id.eq.${orgId},organization_id.is.null`);
    } else {
      query = query.eq("organization_id", orgId);
    }
    await query;
  },
  getUsers: async (orgId) => {
    if (!checkConfig()) return null;
    try {
      let query = supabase.from("users").select("*");
      if (orgId === "demo_org") {
        query = query.or("organization_id.eq.demo_org,organization_id.is.null,organization_id.eq.");
      } else {
        query = query.eq("organization_id", orgId);
      }
      const { data, error } = await query.order("name");
      if (error) {
        if (error.code === "42703" || error.code === "PGRST204" || error.message?.includes("column")) {
          console.warn("organization_id column missing in users, fetching all users");
          const { data: allData, error: allError } = await supabase.from("users").select("*").order("name");
          if (allError) throw allError;
          return (allData || []).map((u) => ({
            id: cleanValue(u.id),
            name: u.name,
            role: u.role,
            department: u.department,
            position: u.position,
            pin: u.pin,
            requirePhoto: u.require_photo,
            isAdmin: u.is_admin,
            forcePinChange: u.force_pin_change,
            organizationId: cleanValue(u.organization_id),
            pushToken: u.push_token,
            plannedShifts: u.planned_shifts,
            payroll: u.payroll,
            telegramChatId: u.telegram_chat_id,
            telegramSettings: u.telegram_settings,
            isArchived: u.is_archived,
            archivedAt: u.archived_at,
            archiveReason: u.archive_reason
          }));
        }
        throw error;
      }
      return (data || []).map((u) => ({
        id: cleanValue(u.id),
        name: u.name,
        role: u.role,
        department: u.department,
        position: u.position,
        pin: u.pin,
        requirePhoto: u.require_photo,
        isAdmin: u.is_admin,
        forcePinChange: u.force_pin_change,
        organizationId: cleanValue(u.organization_id),
        branchId: cleanValue(u.branch_id),
        pushToken: u.push_token,
        plannedShifts: u.planned_shifts,
        payroll: u.payroll,
        telegramChatId: u.telegram_chat_id,
        telegramSettings: u.telegram_settings,
        isArchived: u.is_archived,
        archivedAt: u.archived_at,
        archiveReason: u.archive_reason
      }));
    } catch (e) {
      console.error("Error in getUsers:", e);
      return null;
    }
  },
  getMonthlyReport: async (orgId, month) => {
    if (!isConfigured()) return null;
    try {
      const { data, error } = await supabase.rpc("get_monthly_report", { p_org_id: orgId, p_month: month });
      if (error) {
        console.error("Error fetching monthly report:", error);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  },
  getUserStats: async (userId, month) => {
    if (!isConfigured()) return null;
    try {
      const { data, error } = await supabase.rpc("get_user_stats", { p_user_id: userId, p_month: month });
      if (error) {
        console.error("Error fetching user stats:", error);
        return null;
      }
      return data?.[0] || null;
    } catch (e) {
      return null;
    }
  },
  upsertUser: async (user, orgId) => {
    if (!isConfigured()) return { error: "Not configured" };
    const payload = {
      id: user.id,
      name: user.name,
      role: user.role,
      department: user.department,
      position: user.position,
      pin: user.pin,
      require_photo: user.requirePhoto,
      is_admin: user.isAdmin,
      force_pin_change: user.forcePinChange,
      organization_id: orgId
    };
    if (user.pushToken !== void 0) {
      payload.push_token = user.pushToken;
    }
    if (user.plannedShifts !== void 0) {
      payload.planned_shifts = user.plannedShifts;
    }
    if (user.payroll !== void 0) {
      payload.payroll = user.payroll;
    }
    if (user.telegramChatId !== void 0) {
      payload.telegram_chat_id = user.telegramChatId;
    }
    if (user.telegramSettings !== void 0) {
      payload.telegram_settings = user.telegramSettings;
    }
    if (user.branchId !== void 0) {
      payload.branch_id = user.branchId;
    }
    if (user.isArchived !== void 0) {
      payload.is_archived = user.isArchived;
    }
    if (user.archivedAt !== void 0) {
      payload.archived_at = user.archivedAt;
    }
    if (user.archiveReason !== void 0) {
      payload.archive_reason = user.archiveReason;
    }
    const { error } = await supabase.from("users").upsert(payload);
    if (error) {
      console.error("Error saving user:", error);
      if (error.code === "42703" || error.code === "PGRST204" || error.message?.includes("column")) {
        const { push_token, planned_shifts, payroll, telegram_chat_id, telegram_settings, branch_id, is_archived, archived_at, archive_reason, ...minimalPayload } = payload;
        const { error: retryError } = await supabase.from("users").upsert(minimalPayload);
        return { error: retryError };
      }
    }
    return { error };
  },
  batchUpsertUsers: async (users, orgId) => {
    if (!isConfigured() || users.length === 0) return { error: "Not configured" };
    const payload = users.map((user) => {
      const p = {
        id: user.id,
        name: user.name,
        role: user.role,
        department: user.department,
        position: user.position,
        pin: user.pin,
        require_photo: user.requirePhoto,
        is_admin: user.isAdmin,
        force_pin_change: user.forcePinChange,
        organization_id: orgId,
        push_token: user.pushToken !== void 0 ? user.pushToken : null,
        planned_shifts: user.plannedShifts !== void 0 ? user.plannedShifts : null,
        payroll: user.payroll !== void 0 ? user.payroll : null,
        telegram_chat_id: user.telegramChatId !== void 0 ? user.telegramChatId : null,
        telegram_settings: user.telegramSettings !== void 0 ? user.telegramSettings : null,
        branch_id: user.branchId !== void 0 ? user.branchId : null
      };
      return p;
    });
    const { error } = await supabase.from("users").upsert(payload);
    if (error) {
      console.error("Error batch upserting users:", error);
      if (error.code === "42703" || error.code === "PGRST204" || error.message?.includes("column")) {
        const minimalPayload = payload.map((p) => {
          const { push_token, planned_shifts, payroll, telegram_chat_id, telegram_settings, branch_id, ...rest } = p;
          return rest;
        });
        const { error: retryError } = await supabase.from("users").upsert(minimalPayload);
        return { error: retryError };
      }
    }
    return { error };
  },
  deleteUser: async (id, orgId, reason) => {
    if (!isConfigured()) return { error: "Not configured" };
    const { error } = await supabase.from("users").update({
      is_archived: true,
      archived_at: (/* @__PURE__ */ new Date()).toISOString(),
      archive_reason: reason || "\u0423\u0434\u0430\u043B\u0435\u043D \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u043C"
    }).eq("id", id).eq("organization_id", orgId);
    return { error };
  },
  getArchivedUsers: async (orgId) => {
    if (!checkConfig()) return null;
    try {
      const { data, error } = await supabase.from("users").select("*").eq("organization_id", orgId).eq("is_archived", true).order("archived_at", { ascending: false });
      if (error) return null;
      return (data || []).map((u) => ({
        id: cleanValue(u.id),
        name: u.name,
        role: u.role,
        department: u.department,
        position: u.position,
        pin: u.pin,
        requirePhoto: u.require_photo,
        isAdmin: u.is_admin,
        forcePinChange: u.force_pin_change,
        organizationId: cleanValue(u.organization_id),
        branchId: cleanValue(u.branch_id),
        pushToken: u.push_token,
        plannedShifts: u.planned_shifts,
        payroll: u.payroll,
        telegramChatId: u.telegram_chat_id,
        telegramSettings: u.telegram_settings,
        isArchived: u.is_archived,
        archivedAt: u.archived_at,
        archiveReason: u.archive_reason
      }));
    } catch (e) {
      return null;
    }
  },
  getMachines: async (orgId) => {
    if (!checkConfig()) return null;
    let query = supabase.from("machines").select("*");
    if (orgId === "demo_org") {
      query = query.or("organization_id.eq.demo_org,organization_id.is.null");
    } else {
      query = query.eq("organization_id", orgId);
    }
    const { data } = await query.order("name");
    return (data || []).filter((m) => !m.is_archived).map((m) => {
      const { organization_id, branch_id, is_archived, ...rest } = m;
      return {
        ...rest,
        id: cleanValue(m.id),
        organizationId: cleanValue(organization_id),
        branchId: cleanValue(branch_id),
        isArchived: is_archived,
        archivedAt: m.archived_at,
        archiveReason: m.archive_reason
      };
    }) || null;
  },
  getArchivedMachines: async (orgId) => {
    if (!checkConfig()) return null;
    const { data, error } = await supabase.from("machines").select("*").eq("organization_id", orgId).eq("is_archived", true).order("archived_at", { ascending: false });
    if (error) return null;
    return (data || []).map((m) => ({
      id: cleanValue(m.id),
      name: m.name,
      organizationId: cleanValue(m.organization_id),
      branchId: cleanValue(m.branch_id),
      isArchived: m.is_archived,
      archivedAt: m.archived_at,
      archiveReason: m.archive_reason
    }));
  },
  saveMachines: async (machines, orgId, deletedMachineInfo) => {
    if (!checkConfig()) return { error: "Not configured" };
    const { data: existing, error: fetchError } = await supabase.from("machines").select("id, name").eq("organization_id", orgId).eq("is_archived", false);
    if (fetchError) {
      console.error("Error fetching existing machines for sync:", fetchError);
    }
    const newIds = machines.map((m) => m.id);
    const toArchive = existing ? existing.filter((e) => !newIds.includes(e.id)) : [];
    if (toArchive.length > 0) {
      for (const m of toArchive) {
        const info = deletedMachineInfo?.find((i) => i.id === m.id);
        await supabase.from("machines").update({
          is_archived: true,
          archived_at: (/* @__PURE__ */ new Date()).toISOString(),
          archive_reason: info?.reason || "\u0423\u0434\u0430\u043B\u0435\u043D \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u043C"
        }).eq("id", m.id).eq("organization_id", orgId);
      }
    }
    if (machines.length > 0) {
      const payload = machines.map((m) => ({
        id: m.id,
        name: m.name,
        organization_id: orgId,
        branch_id: m.branchId || null,
        is_archived: false
      }));
      const { error } = await supabase.from("machines").upsert(payload);
      if (error && (error.code === "42703" || error.code === "PGRST204" || error.message?.includes("column"))) {
        const minimalPayload = payload.map((p) => {
          const { branch_id, is_archived, ...rest } = p;
          return rest;
        });
        const { error: retryError } = await supabase.from("machines").upsert(
          minimalPayload,
          { onConflict: "id" }
        );
        return { error: retryError };
      }
      return { error };
    }
    return { error: null };
  },
  getPositions: async (orgId) => {
    if (!checkConfig()) return null;
    let query = supabase.from("positions").select("*");
    if (orgId === "demo_org") {
      query = query.or("organization_id.eq.demo_org,organization_id.is.null");
    } else {
      query = query.eq("organization_id", orgId);
    }
    const { data, error } = await query.order("name");
    if (error) {
      console.error("Error fetching positions:", error);
      return null;
    }
    return data?.map((p) => ({
      name: p.name,
      permissions: p.permissions || {},
      payroll: p.payroll
    })) || [];
  },
  savePositions: async (positions, orgId) => {
    if (!checkConfig()) return { error: "Not configured" };
    const uniquePositions = positions.reduce((acc, current) => {
      const x = acc.find((item) => item.name === current.name);
      if (!x) {
        return acc.concat([current]);
      } else {
        return acc;
      }
    }, []);
    console.log("Saving unique positions for org:", orgId, uniquePositions);
    try {
      const { data: existing, error: fetchError } = await supabase.from("positions").select("name").eq("organization_id", orgId);
      if (fetchError) {
        console.error("Error fetching existing positions for sync:", fetchError);
      }
      const newNames = uniquePositions.map((p) => p.name);
      const toDelete = existing ? existing.filter((e) => !newNames.includes(e.name)).map((e) => e.name) : [];
      if (toDelete.length > 0) {
        console.log("Deleting removed positions:", toDelete);
        const { error: delError } = await supabase.from("positions").delete().eq("organization_id", orgId).in("name", toDelete);
        if (delError) {
          console.error("Error deleting removed positions:", delError);
        }
      }
      if (uniquePositions.length > 0) {
        const upsertData = uniquePositions.map((p) => ({
          name: p.name,
          permissions: p.permissions || {},
          payroll: p.payroll || {},
          organization_id: orgId
        }));
        console.log("Upserting positions:", upsertData);
        const { error: upsertError } = await supabase.from("positions").upsert(upsertData, { onConflict: "organization_id,name" });
        if (upsertError) {
          console.error("Upsert failed, falling back to delete/insert:", upsertError);
          const { error: finalDelError } = await supabase.from("positions").delete().eq("organization_id", orgId);
          if (finalDelError) return { error: finalDelError };
          const { error: insertError } = await supabase.from("positions").insert(upsertData);
          if (insertError) return { error: insertError };
        }
      } else if (toDelete.length === 0 && existing && existing.length > 0) {
        const { error: clearError } = await supabase.from("positions").delete().eq("organization_id", orgId);
        return { error: clearError };
      }
      return { error: null };
    } catch (err) {
      console.error("Unexpected error in savePositions:", err);
      return { error: err };
    }
  },
  getBranches: async (orgId) => {
    if (!checkConfig()) return null;
    try {
      let query = supabase.from("branches").select("*");
      if (orgId === "demo_org") {
        query = query.or("organization_id.eq.demo_org,organization_id.is.null");
      } else {
        query = query.eq("organization_id", orgId);
      }
      const { data, error } = await query.order("name");
      if (error) {
        console.warn("Error fetching branches (might not exist yet):", error.message);
        return [];
      }
      return (data || []).map((b) => ({
        id: cleanValue(b.id),
        organizationId: cleanValue(b.organization_id),
        name: b.name,
        address: b.address,
        locationSettings: b.location_settings
      }));
    } catch (e) {
      console.error("Exception in getBranches:", e);
      return [];
    }
  },
  upsertBranch: async (branch, orgId) => {
    if (!checkConfig()) return { error: "Not configured" };
    const payload = {
      id: branch.id,
      organization_id: orgId,
      name: branch.name,
      address: branch.address,
      location_settings: branch.locationSettings
    };
    const { error } = await supabase.from("branches").upsert(payload);
    return { error };
  },
  deleteBranch: async (branchId, orgId) => {
    if (!checkConfig()) return { error: "Not configured" };
    const { error } = await supabase.from("branches").delete().eq("id", branchId).eq("organization_id", orgId);
    return { error };
  },
  getSystemConfig: async () => {
    if (!checkConfig()) return null;
    const { data } = await supabase.from("system_config").select("*").single();
    return data;
  },
  getServerTime: async () => {
    if (!checkConfig()) return (/* @__PURE__ */ new Date()).toISOString();
    try {
      const { data, error } = await supabase.rpc("get_server_time");
      if (!error && data) return data;
      const { data: timeData, error: timeError } = await supabase.from("active_shifts").select("created_at").limit(1);
      return (/* @__PURE__ */ new Date()).toISOString();
    } catch (e) {
      return (/* @__PURE__ */ new Date()).toISOString();
    }
  },
  updateSystemConfig: async (config) => {
    if (!checkConfig()) return;
    await supabase.from("system_config").upsert({ id: "global", ...config });
  },
  getActiveShifts: async (userId, orgId) => {
    if (!isConfigured()) return null;
    const { data, error } = await supabase.from("active_shifts").select("shifts, shifts_json").eq("user_id", userId).eq("organization_id", orgId).maybeSingle();
    if (error) return null;
    let parsedShifts = data?.shifts || data?.shifts_json || { 1: null, 2: null, 3: null };
    if (typeof parsedShifts === "string") {
      try {
        parsedShifts = JSON.parse(parsedShifts);
      } catch (e) {
      }
    }
    return parsedShifts;
  },
  saveActiveShifts: async (userId, shifts, orgId) => {
    if (!isConfigured()) return { error: "Not configured" };
    console.log("\u{1F4DD} Saving Active Shifts:", userId, shifts, orgId);
    const isEmpty = !shifts || typeof shifts === "object" && Object.values(shifts).every((s) => s === null);
    if (isEmpty) {
      console.log("\u{1F5D1}\uFE0F Deleting active shifts for user:", userId);
      const { error } = await supabase.from("active_shifts").delete().eq("user_id", userId);
      if (error) console.error("\u274C Error deleting active shifts:", error);
      return { error };
    }
    const payload = {
      user_id: userId,
      shifts_json: shifts
    };
    if (orgId && orgId !== "demo_org") {
      payload.organization_id = orgId;
    }
    payload.shifts = shifts;
    try {
      const { error } = await supabase.from("active_shifts").upsert(payload, { onConflict: "user_id" });
      if (error) {
        console.warn("\u26A0\uFE0F First upsert attempt failed, trying fallback:", error);
        if (error.code === "42703" || error.code === "PGRST204" || error.message?.includes("column")) {
          console.warn("\u26A0\uFE0F Missing column detected, attempting to strip optional fields...");
          const { shifts: shifts2, ...try1 } = payload;
          const { error: error1 } = await supabase.from("active_shifts").upsert(try1, { onConflict: "user_id" });
          if (!error1) {
            console.log("\u2705 Fallback 1 (no shifts) successful");
            return { error: null };
          }
          const { organization_id, ...try2 } = payload;
          const { error: error2 } = await supabase.from("active_shifts").upsert(try2, { onConflict: "user_id" });
          if (!error2) {
            console.log("\u2705 Fallback 2 (no org_id) successful");
            return { error: null };
          }
          const { shifts: s, organization_id: o, ...try3 } = payload;
          const { error: error3 } = await supabase.from("active_shifts").upsert(try3, { onConflict: "user_id" });
          if (!error3) {
            console.log("\u2705 Fallback 3 (minimal) successful");
            return { error: null };
          }
          console.error("\u274C All fallbacks failed:", error3);
          return { error: error3 };
        }
        if (error.code === "42P10" || error.message?.includes("conflict")) {
          const { error: retryError2 } = await supabase.from("active_shifts").upsert(payload);
          return { error: retryError2 };
        }
        return { error };
      }
      console.log("\u2705 Active shifts saved successfully");
      return { error: null };
    } catch (e) {
      console.error("Exception in saveActiveShifts:", e);
      return { error: e.message };
    }
  },
  getAllActiveShifts: async (orgId) => {
    if (!checkConfig()) return null;
    let query = supabase.from("active_shifts").select("*");
    if (orgId === "demo_org") {
      query = query.or("organization_id.eq.demo_org,organization_id.is.null");
    } else {
      query = query.eq("organization_id", orgId);
    }
    const { data, error } = await query;
    if (error) {
      if (error.code === "42703" || error.code === "PGRST204" || error.message?.includes("column")) {
        const { data: allData, error: allErrors } = await supabase.from("active_shifts").select("*");
        if (allErrors) return null;
        return (allData || []).map((s) => ({
          ...s,
          user_id: cleanValue(s.user_id),
          organization_id: cleanValue(s.organization_id)
        }));
      }
      console.error("Error fetching active shifts:", error);
      return null;
    }
    return (data || []).map((s) => ({
      ...s,
      user_id: cleanValue(s.user_id),
      organization_id: cleanValue(s.organization_id)
    }));
  },
  // Super-Admin methods
  getPlans: async () => {
    if (!checkConfig()) return null;
    const { data, error } = await supabase.from("plans").select("*").order("type");
    if (error) return null;
    return data;
  },
  savePlan: async (plan) => {
    if (!isConfigured()) return;
    const { error } = await supabase.from("plans").upsert(plan);
    if (error) console.error("Error saving plan:", error);
  },
  getAllOrganizations: async () => {
    if (!checkConfig()) return null;
    const { data, error } = await supabase.from("organizations").select("*").order("name");
    if (error) return null;
    return data.map((org) => ({
      ...org,
      ownerId: org.owner_id,
      expiryDate: org.expiry_date,
      notificationSettings: org.notification_settings,
      locationSettings: org.location_settings || org.notification_settings?.locationSettings,
      telegramSettings: org.telegram_settings || org.notification_settings?.telegramSettings,
      maxShiftDuration: org.max_shift_duration,
      roundShiftMinutes: org.round_shift_minutes,
      nightShiftBonus: org.night_shift_bonus,
      createdAt: org.created_at
    }));
  },
  getGlobalStats: async () => {
    if (!checkConfig()) return null;
    try {
      const { data, error } = await supabase.rpc("get_user_counts_by_org");
      if (!error && data) {
        const stats2 = {};
        data.forEach((item) => {
          stats2[item.organization_id || "unknown"] = item.user_count;
        });
        return stats2;
      }
      console.warn("RPC get_user_counts_by_org not found, using fallback method");
      const { data: users, error: usersError } = await supabase.from("users").select("organization_id");
      if (usersError) return null;
      const stats = {};
      users.forEach((u) => {
        const orgId = u.organization_id || "unknown";
        stats[orgId] = (stats[orgId] || 0) + 1;
      });
      return stats;
    } catch (e) {
      console.error("Error in getGlobalStats:", e);
      return null;
    }
  },
  updateOrganization: async (orgId, updates) => {
    const cached = localStorage.getItem(STORAGE_KEYS.ORG_DATA);
    if (cached) {
      try {
        const org = JSON.parse(cached);
        if (org.id === orgId) {
          const updatedOrg = { ...org, ...updates };
          localStorage.setItem(STORAGE_KEYS.ORG_DATA, JSON.stringify(updatedOrg));
        }
      } catch (e) {
        console.error("Error updating local org data:", e);
      }
    }
    if (!checkConfig()) return { error: "Not configured" };
    const dbUpdates = { ...updates };
    if (updates.ownerId !== void 0) {
      dbUpdates.owner_id = updates.ownerId;
      delete dbUpdates.ownerId;
    }
    if (updates.expiryDate !== void 0) {
      dbUpdates.expiry_date = updates.expiryDate;
      delete dbUpdates.expiryDate;
    }
    if (updates.notificationSettings !== void 0) {
      dbUpdates.notification_settings = updates.notificationSettings;
      delete dbUpdates.notificationSettings;
    }
    if (updates.maxShiftDuration !== void 0) {
      dbUpdates.max_shift_duration = updates.maxShiftDuration;
      delete dbUpdates.maxShiftDuration;
    }
    if (updates.roundShiftMinutes !== void 0) {
      dbUpdates.round_shift_minutes = updates.roundShiftMinutes;
      delete dbUpdates.roundShiftMinutes;
    }
    if (updates.nightShiftBonus !== void 0) {
      dbUpdates.night_shift_bonus = updates.nightShiftBonus;
      delete dbUpdates.nightShiftBonus;
    }
    if (updates.locationSettings !== void 0) {
      dbUpdates.location_settings = updates.locationSettings;
      delete dbUpdates.locationSettings;
    }
    if (updates.telegramSettings !== void 0) {
      dbUpdates.telegram_settings = updates.telegramSettings;
      delete dbUpdates.telegramSettings;
    }
    const { error } = await supabase.from("organizations").update(dbUpdates).eq("id", orgId);
    if (error) {
      console.error("Error updating organization:", error);
      if (error.code === "42703" || error.code === "PGRST204" || error.message?.includes("column")) {
        console.warn("Retrying organization update without new settings columns...");
        const { data: currentOrg } = await supabase.from("organizations").select("notification_settings").eq("id", orgId).single();
        let mergedSettings = currentOrg?.notification_settings || {};
        if (dbUpdates.notification_settings) {
          mergedSettings = { ...mergedSettings, ...dbUpdates.notification_settings };
        }
        if (dbUpdates.location_settings) {
          mergedSettings.locationSettings = dbUpdates.location_settings;
        }
        if (dbUpdates.telegram_settings) {
          mergedSettings.telegramSettings = dbUpdates.telegram_settings;
        }
        const { notification_settings, location_settings, telegram_settings, ...minimalUpdates } = dbUpdates;
        minimalUpdates.notification_settings = mergedSettings;
        const { error: retryError } = await supabase.from("organizations").update(minimalUpdates).eq("id", orgId);
        return { error: retryError };
      }
    }
    return { error };
  },
  createOrganization: async (org) => {
    if (!checkConfig()) return;
    const { error } = await supabase.from("organizations").upsert({
      id: org.id,
      name: org.name,
      email: org.email,
      owner_id: org.ownerId,
      plan: org.plan,
      status: org.status,
      expiry_date: org.expiryDate,
      notification_settings: org.notificationSettings,
      location_settings: org.locationSettings,
      telegram_settings: org.telegramSettings,
      max_shift_duration: org.maxShiftDuration,
      round_shift_minutes: org.roundShiftMinutes,
      night_shift_bonus: org.nightShiftBonus
    }, { onConflict: "id" });
    if (error && error.code !== "23505") {
      console.error("Error creating organization:", error);
      if (error.code === "42703" || error.code === "PGRST204" || error.message?.includes("column")) {
        let mergedSettings = org.notificationSettings || {};
        if (org.locationSettings) mergedSettings.locationSettings = org.locationSettings;
        if (org.telegramSettings) mergedSettings.telegramSettings = org.telegramSettings;
        await supabase.from("organizations").upsert({
          id: org.id,
          name: org.name,
          email: org.email,
          owner_id: org.ownerId,
          plan: org.plan,
          status: org.status,
          expiry_date: org.expiryDate,
          notification_settings: mergedSettings,
          max_shift_duration: org.maxShiftDuration,
          round_shift_minutes: org.roundShiftMinutes,
          night_shift_bonus: org.nightShiftBonus
        }, { onConflict: "id" });
      }
    }
  },
  getOrganizationByEmail: async (email) => {
    if (!checkConfig()) return null;
    const { data, error } = await supabase.from("organizations").select("*").eq("email", email).maybeSingle();
    if (error || !data) return null;
    return {
      ...data,
      ownerId: data.owner_id,
      expiryDate: data.expiry_date,
      notificationSettings: data.notification_settings,
      locationSettings: data.location_settings || data.notification_settings?.locationSettings,
      telegramSettings: data.telegram_settings || data.notification_settings?.telegramSettings,
      maxShiftDuration: data.max_shift_duration,
      roundShiftMinutes: data.round_shift_minutes,
      nightShiftBonus: data.night_shift_bonus
    };
  },
  resetAdminPin: async (orgId, newPin) => {
    if (!checkConfig()) return;
    const { error } = await supabase.from("users").update({ pin: newPin }).eq("organization_id", orgId).eq("id", "admin");
    if (error) console.error("Error resetting admin pin:", error);
  },
  createBucket: async (bucketName) => {
    if (!isConfigured()) return { error: "Not configured" };
    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: true
    });
    return { data, error };
  },
  repairOrganizationData: async (orgId) => {
    if (!checkConfig()) return { error: "Not configured" };
    try {
      console.log("Starting deep repair for organization:", orgId);
      const { data: activeShifts } = await supabase.from("active_shifts").select("user_id").eq("organization_id", orgId);
      const userIdsFromShifts = [...new Set((activeShifts || []).map((s) => s.user_id))];
      const { data: logs } = await supabase.from("work_logs").select("user_id").eq("organization_id", orgId);
      const userIdsFromLogs = [...new Set((logs || []).map((l) => l.user_id))];
      const allKnownUserIds = [.../* @__PURE__ */ new Set([...userIdsFromShifts, ...userIdsFromLogs])];
      if (allKnownUserIds.length > 0) {
        console.log(`Found ${allKnownUserIds.length} unique user IDs in logs/shifts for this org.`);
        const { error: updateError } = await supabase.from("users").update({ organization_id: orgId }).in("id", allKnownUserIds);
        if (updateError) console.error("Error updating users during repair:", updateError);
      }
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  },
  getFullSqlSchema: () => {
    return `
-- === FULL DATABASE SCHEMA FOR WORK TRACKER PRO ===

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  owner_id TEXT NOT NULL,
  plan TEXT DEFAULT 'FREE',
  status TEXT DEFAULT 'active',
  expiry_date TIMESTAMPTZ,
  notification_settings JSONB DEFAULT '{}',
  location_settings JSONB,
  telegram_settings JSONB,
  max_shift_duration INTEGER DEFAULT 720,
  round_shift_minutes BOOLEAN DEFAULT false
);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON organizations;
CREATE POLICY "Allow public read" ON organizations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON organizations;
CREATE POLICY "Allow public insert" ON organizations FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON organizations;
CREATE POLICY "Allow public update" ON organizations FOR UPDATE USING (true);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'EMPLOYEE',
  department TEXT,
  position TEXT,
  pin TEXT NOT NULL,
  require_photo BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  force_pin_change BOOLEAN DEFAULT false,
  push_token TEXT,
  planned_shifts JSONB DEFAULT '{}',
  payroll JSONB DEFAULT '{}'
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON users;
CREATE POLICY "Allow public read" ON users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON users;
CREATE POLICY "Allow public insert" ON users FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON users;
CREATE POLICY "Allow public update" ON users FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON users;
CREATE POLICY "Allow public delete" ON users FOR DELETE USING (true);

-- 3. Work Logs
CREATE TABLE IF NOT EXISTS work_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  date TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  machine_id TEXT,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 0,
  photo_in TEXT,
  photo_out TEXT,
  is_corrected BOOLEAN DEFAULT false,
  correction_note TEXT,
  correction_timestamp TIMESTAMPTZ,
  is_night_shift BOOLEAN DEFAULT false,
  fine INTEGER DEFAULT 0,
  bonus INTEGER DEFAULT 0,
  items_produced INTEGER,
  location JSONB,
  branch_id TEXT
);
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON work_logs;
CREATE POLICY "Allow public read" ON work_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON work_logs;
CREATE POLICY "Allow public insert" ON work_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON work_logs;
CREATE POLICY "Allow public update" ON work_logs FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON work_logs;
CREATE POLICY "Allow public delete" ON work_logs FOR DELETE USING (true);

-- 4. Machines
CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  branch_id TEXT,
  is_archived BOOLEAN DEFAULT false
);
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON machines;
CREATE POLICY "Allow public read" ON machines FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON machines;
CREATE POLICY "Allow public insert" ON machines FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON machines;
CREATE POLICY "Allow public update" ON machines FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON machines;
CREATE POLICY "Allow public delete" ON machines FOR DELETE USING (true);

-- 5. Positions
CREATE TABLE IF NOT EXISTS positions (
  name TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  permissions JSONB DEFAULT '{}',
  payroll JSONB DEFAULT '{}',
  PRIMARY KEY (organization_id, name)
);
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON positions;
CREATE POLICY "Allow public read" ON positions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON positions;
CREATE POLICY "Allow public insert" ON positions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON positions;
CREATE POLICY "Allow public update" ON positions FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON positions;
CREATE POLICY "Allow public delete" ON positions FOR DELETE USING (true);

-- 6. Plans
CREATE TABLE IF NOT EXISTS plans (
  type TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  limits JSONB DEFAULT '{}',
  price INTEGER DEFAULT 0
);
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON plans;
CREATE POLICY "Allow public read" ON plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON plans;
CREATE POLICY "Allow public insert" ON plans FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON plans;
CREATE POLICY "Allow public update" ON plans FOR UPDATE USING (true);

-- 7. Promo Codes
CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  plan_type TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  last_used_by TEXT,
  last_used_at TIMESTAMPTZ
);
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON promo_codes;
CREATE POLICY "Allow public read" ON promo_codes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON promo_codes;
CREATE POLICY "Allow public insert" ON promo_codes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON promo_codes;
CREATE POLICY "Allow public update" ON promo_codes FOR UPDATE USING (true);

-- 8. Active Shifts
CREATE TABLE IF NOT EXISTS active_shifts (
  user_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  shifts JSONB DEFAULT '{}',
  shifts_json JSONB DEFAULT '{}'
);
ALTER TABLE active_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON active_shifts;
CREATE POLICY "Allow public read" ON active_shifts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON active_shifts;
CREATE POLICY "Allow public insert" ON active_shifts FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON active_shifts;
CREATE POLICY "Allow public update" ON active_shifts FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON active_shifts;
CREATE POLICY "Allow public delete" ON active_shifts FOR DELETE USING (true);

-- 9. System Config
CREATE TABLE IF NOT EXISTS system_config (
  id TEXT PRIMARY KEY,
  super_admin_pin TEXT,
  global_admin_pin TEXT
);
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON system_config;
CREATE POLICY "Allow public read" ON system_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public update" ON system_config;
CREATE POLICY "Allow public update" ON system_config FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON system_config;
CREATE POLICY "Allow public insert" ON system_config FOR INSERT WITH CHECK (true);

-- Insert default system config
INSERT INTO system_config (id, super_admin_pin, global_admin_pin) 
VALUES ('global', '7777', '0000') 
ON CONFLICT (id) DO NOTHING;

-- 10. Dashboard Stats Function
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_org_id text, p_month text, p_last_7_days text[])
RETURNS json AS $$
DECLARE
    v_total_weekly_minutes bigint;
    v_absences json;
BEGIN
    SELECT COALESCE(SUM(duration_minutes), 0)
    INTO v_total_weekly_minutes
    FROM work_logs
    WHERE organization_id = p_org_id 
      AND date::text = ANY(p_last_7_days)
      AND entry_type = 'WORK';

    SELECT json_agg(t)
    INTO v_absences
    FROM (
        SELECT entry_type as type, COUNT(*) as count
        FROM work_logs
        WHERE organization_id = p_org_id 
          AND date::text LIKE p_month || '%'
          AND entry_type != 'WORK'
        GROUP BY entry_type
    ) t;

    RETURN json_build_object(
        'total_weekly_minutes', v_total_weekly_minutes,
        'top_absences', COALESCE(v_absences, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql;

-- 11. Payroll Snapshots
CREATE TABLE IF NOT EXISTS payroll_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  month TEXT NOT NULL,
  total_minutes INTEGER DEFAULT 0,
  total_salary INTEGER DEFAULT 0,
  bonuses INTEGER DEFAULT 0,
  fines INTEGER DEFAULT 0,
  rate_used INTEGER DEFAULT 0,
  rate_type TEXT NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  details JSONB DEFAULT '{}'
);
ALTER TABLE payroll_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON payroll_snapshots;
CREATE POLICY "Allow public read" ON payroll_snapshots FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON payroll_snapshots;
CREATE POLICY "Allow public insert" ON payroll_snapshots FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON payroll_snapshots;
CREATE POLICY "Allow public update" ON payroll_snapshots FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON payroll_snapshots;
CREATE POLICY "Allow public delete" ON payroll_snapshots FOR DELETE USING (true);

-- 12. Payroll Payments
CREATE TABLE IF NOT EXISTS payroll_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payroll_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON payroll_payments;
CREATE POLICY "Allow public read" ON payroll_payments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON payroll_payments;
CREATE POLICY "Allow public insert" ON payroll_payments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON payroll_payments;
CREATE POLICY "Allow public update" ON payroll_payments FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON payroll_payments;
CREATE POLICY "Allow public delete" ON payroll_payments FOR DELETE USING (true);
-- 13. Payroll Periods
CREATE TABLE IF NOT EXISTS payroll_periods (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  closed_at TIMESTAMPTZ,
  closed_by TEXT
);
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON payroll_periods;
CREATE POLICY "Allow public read" ON payroll_periods FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON payroll_periods;
CREATE POLICY "Allow public insert" ON payroll_periods FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON payroll_periods;
CREATE POLICY "Allow public update" ON payroll_periods FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON payroll_periods;
CREATE POLICY "Allow public delete" ON payroll_periods FOR DELETE USING (true);

-- 14. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  admin_id TEXT NOT NULL,
  admin_name TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  changes TEXT,
  target_user_id TEXT,
  target_user_name TEXT
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON audit_logs;
CREATE POLICY "Allow public read" ON audit_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON audit_logs;
CREATE POLICY "Allow public insert" ON audit_logs FOR INSERT WITH CHECK (true);
-- 15. Payment History
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  plan_type TEXT NOT NULL,
  status TEXT NOT NULL,
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON payment_history;
CREATE POLICY "Allow public read" ON payment_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON payment_history;
CREATE POLICY "Allow public insert" ON payment_history FOR INSERT WITH CHECK (true);
    `;
  },
  saveSubscriptionPayment: async (payment) => {
    if (!isConfigured()) return { error: "Not configured" };
    const { error } = await supabase.from("payment_history").insert(payment);
    return { error };
  },
  getSubscriptionHistory: async (orgId) => {
    if (!checkConfig()) return null;
    const { data, error } = await supabase.from("payment_history").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
    return data;
  },
  getDiagnostics: async () => {
    const results = {
      config: {
        urlSet: SUPABASE_URL !== "https://placeholder-project.supabase.co" && SUPABASE_URL.trim() !== "",
        keySet: SUPABASE_ANON_KEY !== "placeholder-anon-key" && SUPABASE_ANON_KEY.trim() !== ""
      },
      tables: {},
      columns: {},
      sqlFixes: []
    };
    if (!results.config.urlSet || !results.config.keySet) {
      return { ...results, status: "error", message: "Supabase URL or Key is not configured in environment variables." };
    }
    try {
      const tablesToCheck = ["organizations", "users", "work_logs", "machines", "positions", "plans", "promo_codes", "active_shifts", "system_config", "payroll_snapshots", "payroll_payments", "payroll_periods", "payment_history", "support_messages"];
      results.storage = {};
      try {
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        if (bucketsError) {
          results.storage.photos = { status: "error", message: bucketsError.message };
        } else {
          const photosBucket = buckets.find((b) => b.name === "photos");
          if (photosBucket) {
            results.storage.photos = { status: "ok", public: photosBucket.public };
          } else {
            results.storage.photos = { status: "missing", message: 'Bucket "photos" \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D' };
            results.sqlFixes.push(`
-- === \u0418\u0421\u041F\u0420\u0410\u0412\u041B\u0415\u041D\u0418\u0415 \u0425\u0420\u0410\u041D\u0418\u041B\u0418\u0429\u0410 (STORAGE) ===
-- \u0415\u0441\u043B\u0438 \u043F\u0440\u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0438 \u0432\u043E\u0437\u043D\u0438\u043A\u0430\u0435\u0442 \u043E\u0448\u0438\u0431\u043A\u0430 "must be owner", 
-- \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0431\u0430\u043A\u0435\u0442 "photos" \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u0447\u0435\u0440\u0435\u0437 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 Supabase (Storage -> New Bucket)

-- 1. \u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u0431\u0430\u043A\u0435\u0442\u0430 "photos"
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', true) 
ON CONFLICT (id) DO NOTHING;

-- 2. \u041F\u043E\u043B\u0438\u0442\u0438\u043A\u0438 \u0434\u043B\u044F \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u0432 \u0432 \u0431\u0430\u043A\u0435\u0442\u0435 "photos"
-- \u041C\u044B \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u043C \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u043E\u0432\u0430\u043D\u0438\u044F, \u0447\u0442\u043E\u0431\u044B \u0438\u0437\u0431\u0435\u0436\u0430\u0442\u044C \u043E\u0448\u0438\u0431\u043E\u043A

DO $$
BEGIN
    -- \u0420\u0430\u0437\u0440\u0435\u0448\u0430\u0435\u043C \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u043E\u0435 \u0447\u0442\u0435\u043D\u0438\u0435
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
    END IF;

    -- \u0420\u0430\u0437\u0440\u0435\u0448\u0430\u0435\u043C \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443 (INSERT)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Uploads' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Allow Uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photos');
    END IF;

    -- \u0420\u0430\u0437\u0440\u0435\u0448\u0430\u0435\u043C \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u0435 (DELETE)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Delete' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Allow Delete" ON storage.objects FOR DELETE USING (bucket_id = 'photos');
    END IF;

    -- \u0420\u0430\u0437\u0440\u0435\u0448\u0430\u0435\u043C \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 (UPDATE)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Update' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Allow Update" ON storage.objects FOR UPDATE USING (bucket_id = 'photos');
    END IF;
END
$$;

-- 3. \u0420\u0430\u0437\u0440\u0435\u0448\u0430\u0435\u043C \u0430\u043D\u043E\u043D\u0438\u043C\u043D\u044B\u0439 \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u0441\u043F\u0438\u0441\u043A\u0443 \u0431\u0430\u043A\u0435\u0442\u043E\u0432 (\u0434\u043B\u044F \u0434\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0438)
-- \u0415\u0441\u043B\u0438 \u044D\u0442\u0430 \u0447\u0430\u0441\u0442\u044C \u0432\u044B\u0434\u0430\u0435\u0442 \u043E\u0448\u0438\u0431\u043A\u0443, \u043F\u0440\u043E\u0441\u0442\u043E \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0435\u0451 - \u043E\u043D\u0430 \u043D\u0443\u0436\u043D\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u0440\u0430\u0431\u043E\u0442\u044B \u043A\u043D\u043E\u043F\u043A\u0438 "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C" \u0432 \u0430\u0434\u043C\u0438\u043D\u043A\u0435
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read buckets' AND tablename = 'buckets' AND schemaname = 'storage') THEN
        CREATE POLICY "Allow public read buckets" ON storage.buckets FOR SELECT USING (true);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not create policy on buckets table, skipping...';
END
$$;
            `);
          }
        }
      } catch (e) {
        results.storage.photos = { status: "error", message: e.message };
      }
      for (const table of tablesToCheck) {
        const { error } = await supabase.from(table).select("count", { count: "exact", head: true }).limit(0);
        const isMissing = error && (error.message.includes("does not exist") || error.code === "42P01");
        results.tables[table] = error ? { status: "error", message: error.message } : { status: "ok" };
        if (!error) {
        }
        if (isMissing) {
          if (table === "promo_codes") {
            results.sqlFixes.push(`
CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  plan_type TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  last_used_by TEXT,
  last_used_at TIMESTAMPTZ
);
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON promo_codes;
CREATE POLICY "Allow public read" ON promo_codes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON promo_codes;
CREATE POLICY "Allow public insert" ON promo_codes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON promo_codes;
CREATE POLICY "Allow public update" ON promo_codes FOR UPDATE USING (true);
            `);
          } else if (table === "positions") {
            results.sqlFixes.push(`
CREATE TABLE IF NOT EXISTS positions (
  name TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  permissions JSONB DEFAULT '{}',
  payroll JSONB DEFAULT '{}',
  PRIMARY KEY (organization_id, name)
);
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON positions;
CREATE POLICY "Allow public read" ON positions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON positions;
CREATE POLICY "Allow public insert" ON positions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON positions;
CREATE POLICY "Allow public update" ON positions FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON positions;
CREATE POLICY "Allow public delete" ON positions FOR DELETE USING (true);
            `);
          } else if (table === "system_config") {
            results.sqlFixes.push(`
CREATE TABLE IF NOT EXISTS system_config (
  id TEXT PRIMARY KEY,
  super_admin_pin TEXT,
  global_admin_pin TEXT
);
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON system_config;
CREATE POLICY "Allow public read" ON system_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public update" ON system_config;
CREATE POLICY "Allow public update" ON system_config FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON system_config;
CREATE POLICY "Allow public insert" ON system_config FOR INSERT WITH CHECK (true);

-- Insert default row
INSERT INTO system_config (id, super_admin_pin, global_admin_pin) VALUES ('global', '7777', '0000') ON CONFLICT (id) DO NOTHING;
            `);
          } else {
            if (table === "organizations") {
              results.sqlFixes.push(`
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  owner_id TEXT NOT NULL,
  plan TEXT DEFAULT 'FREE',
  status TEXT DEFAULT 'active',
  expiry_date TIMESTAMPTZ,
  notification_settings JSONB DEFAULT '{}',
  location_settings JSONB,
  telegram_settings JSONB,
  max_shift_duration INTEGER DEFAULT 720,
  round_shift_minutes BOOLEAN DEFAULT false
);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON organizations;
CREATE POLICY "Allow public read" ON organizations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON organizations;
CREATE POLICY "Allow public insert" ON organizations FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON organizations;
CREATE POLICY "Allow public update" ON organizations FOR UPDATE USING (true);
              `);
            } else if (table === "users") {
              results.sqlFixes.push(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'EMPLOYEE',
  department TEXT,
  position TEXT,
  pin TEXT NOT NULL,
  require_photo BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  force_pin_change BOOLEAN DEFAULT false,
  push_token TEXT,
  planned_shifts JSONB DEFAULT '{}',
  payroll JSONB DEFAULT '{}',
  branch_id TEXT
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON users;
CREATE POLICY "Allow public read" ON users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON users;
CREATE POLICY "Allow public insert" ON users FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON users;
CREATE POLICY "Allow public update" ON users FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON users;
CREATE POLICY "Allow public delete" ON users FOR DELETE USING (true);
              `);
            } else if (table === "work_logs") {
              results.sqlFixes.push(`
CREATE TABLE IF NOT EXISTS work_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  date TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  machine_id TEXT,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 0,
  photo_in TEXT,
  photo_out TEXT,
  is_corrected BOOLEAN DEFAULT false,
  correction_note TEXT,
  correction_timestamp TIMESTAMPTZ,
  is_night_shift BOOLEAN DEFAULT false,
  fine INTEGER DEFAULT 0,
  bonus INTEGER DEFAULT 0,
  items_produced INTEGER,
  location JSONB,
  branch_id TEXT
);
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON work_logs;
CREATE POLICY "Allow public read" ON work_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON work_logs;
CREATE POLICY "Allow public insert" ON work_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON work_logs;
CREATE POLICY "Allow public update" ON work_logs FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON work_logs;
CREATE POLICY "Allow public delete" ON work_logs FOR DELETE USING (true);
              `);
            } else if (table === "machines") {
              results.sqlFixes.push(`
CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  branch_id TEXT,
  is_archived BOOLEAN DEFAULT false
);
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON machines;
CREATE POLICY "Allow public read" ON machines FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON machines;
CREATE POLICY "Allow public insert" ON machines FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON machines;
CREATE POLICY "Allow public update" ON machines FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON machines;
CREATE POLICY "Allow public delete" ON machines FOR DELETE USING (true);
              `);
            } else if (table === "plans") {
              results.sqlFixes.push(`
CREATE TABLE IF NOT EXISTS plans (
  type TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  limits JSONB DEFAULT '{}',
  price INTEGER DEFAULT 0
);
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON plans;
CREATE POLICY "Allow public read" ON plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON plans;
CREATE POLICY "Allow public insert" ON plans FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON plans;
CREATE POLICY "Allow public update" ON plans FOR UPDATE USING (true);
              `);
            } else if (table === "active_shifts") {
              results.sqlFixes.push(`
CREATE TABLE IF NOT EXISTS active_shifts (
  user_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  shifts JSONB DEFAULT '{}',
  shifts_json JSONB DEFAULT '{}'
);
ALTER TABLE active_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON active_shifts;
CREATE POLICY "Allow public read" ON active_shifts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON active_shifts;
CREATE POLICY "Allow public insert" ON active_shifts FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON active_shifts;
CREATE POLICY "Allow public update" ON active_shifts FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON active_shifts;
CREATE POLICY "Allow public delete" ON active_shifts FOR DELETE USING (true);
              `);
            } else if (table === "payroll_snapshots") {
              results.sqlFixes.push(`
CREATE TABLE IF NOT EXISTS payroll_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  month TEXT NOT NULL,
  total_minutes INTEGER DEFAULT 0,
  total_salary INTEGER DEFAULT 0,
  bonuses INTEGER DEFAULT 0,
  fines INTEGER DEFAULT 0,
  rate_used INTEGER DEFAULT 0,
  rate_type TEXT NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  details JSONB DEFAULT '{}'
);
ALTER TABLE payroll_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON payroll_snapshots;
CREATE POLICY "Allow public read" ON payroll_snapshots FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON payroll_snapshots;
CREATE POLICY "Allow public insert" ON payroll_snapshots FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON payroll_snapshots;
CREATE POLICY "Allow public update" ON payroll_snapshots FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON payroll_snapshots;
CREATE POLICY "Allow public delete" ON payroll_snapshots FOR DELETE USING (true);
              `);
            } else if (table === "payroll_payments") {
              results.sqlFixes.push(`
CREATE TABLE IF NOT EXISTS payroll_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payroll_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON payroll_payments;
CREATE POLICY "Allow public read" ON payroll_payments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON payroll_payments;
CREATE POLICY "Allow public insert" ON payroll_payments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON payroll_payments;
CREATE POLICY "Allow public update" ON payroll_payments FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON payroll_payments;
CREATE POLICY "Allow public delete" ON payroll_payments FOR DELETE USING (true);
              `);
            } else if (table === "payroll_periods") {
              results.sqlFixes.push(`
CREATE TABLE IF NOT EXISTS payroll_periods (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  closed_at TIMESTAMPTZ,
  closed_by TEXT
);
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON payroll_periods;
CREATE POLICY "Allow public read" ON payroll_periods FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON payroll_periods;
CREATE POLICY "Allow public insert" ON payroll_periods FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON payroll_periods;
CREATE POLICY "Allow public update" ON payroll_periods FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON payroll_periods;
CREATE POLICY "Allow public delete" ON payroll_periods FOR DELETE USING (true);
              `);
            } else if (table === "branches") {
              results.sqlFixes.push(`
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  name TEXT NOT NULL,
  address TEXT,
  location_settings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON branches;
CREATE POLICY "Allow public read" ON branches FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON branches;
CREATE POLICY "Allow public insert" ON branches FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON branches;
CREATE POLICY "Allow public update" ON branches FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete" ON branches;
CREATE POLICY "Allow public delete" ON branches FOR DELETE USING (true);
              `);
            } else {
              results.sqlFixes.push(`-- Table ${table} is missing. Please check Supabase schema.`);
            }
          }
        }
      }
      const expectedSchema = {
        organizations: ["id", "name", "email", "owner_id", "plan", "status", "expiry_date", "notification_settings", "location_settings", "telegram_settings", "max_shift_duration", "round_shift_minutes"],
        users: ["id", "organization_id", "name", "role", "department", "position", "pin", "require_photo", "is_admin", "force_pin_change", "push_token", "planned_shifts", "payroll", "branch_id"],
        work_logs: ["id", "user_id", "organization_id", "date", "entry_type", "machine_id", "check_in", "check_out", "duration_minutes", "photo_in", "photo_out", "is_corrected", "correction_note", "correction_timestamp", "is_night_shift", "fine", "bonus", "items_produced", "location", "branch_id"],
        machines: ["id", "organization_id", "name", "branch_id", "is_archived"],
        positions: ["name", "organization_id", "permissions", "payroll"],
        plans: ["type", "name", "limits", "price"],
        promo_codes: ["id", "code", "plan_type", "duration_days", "max_uses", "used_count", "created_at", "expires_at", "is_active", "last_used_by", "last_used_at"],
        active_shifts: ["user_id", "organization_id", "shifts", "shifts_json"],
        system_config: ["id", "super_admin_pin", "global_admin_pin"],
        payroll_snapshots: ["id", "user_id", "organization_id", "month", "total_minutes", "total_salary", "bonuses", "fines", "rate_used", "rate_type", "calculated_at", "details"],
        payroll_payments: ["id", "user_id", "organization_id", "amount", "date", "type", "comment", "created_at"],
        payroll_periods: ["id", "organization_id", "month", "status", "closed_at", "closed_by"],
        branches: ["id", "organization_id", "name", "address", "location_settings", "created_at"]
      };
      for (const [table, columns] of Object.entries(expectedSchema)) {
        if (results.tables[table]?.status === "ok") {
          for (const col of columns) {
            const { error } = await supabase.from(table).select(col).limit(1);
            if (error) {
              if (error.code === "42P01" || error.message.includes("does not exist")) {
                results.tables[table] = { status: "error", message: error.message };
                break;
              }
              if (error.code === "42703" || error.code === "PGRST204" || error.message.toLowerCase().includes("column") || error.message.toLowerCase().includes("does not exist") || error.message.toLowerCase().includes("not found")) {
                results.columns[`${table}.${col}`] = "missing";
                let colType = "TEXT";
                if (col.includes("count") || col.includes("days") || col.includes("uses") || col.includes("minutes") || col === "price" || col === "fine" || col === "bonus") colType = "INTEGER";
                else if (col.includes("date") || col.includes("_at") || col.includes("timestamp") || col === "check_in" || col === "check_out") colType = "TIMESTAMPTZ";
                else if (col.startsWith("is_") || col.startsWith("require_") || col.startsWith("force_")) colType = "BOOLEAN";
                else if (col === "notification_settings" || col === "permissions" || col === "limits" || col === "shifts_json" || col === "shifts" || col === "planned_shifts" || col === "payroll") colType = "JSONB";
                if (col === "round_shift_minutes") colType = "BOOLEAN";
                if (col === "global_admin_pin") {
                  results.sqlFixes.push(`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS global_admin_pin TEXT DEFAULT '0000';`);
                } else {
                  results.sqlFixes.push(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${colType};`);
                }
              } else {
                console.warn(`Error checking column ${table}.${col}:`, error);
                results.columns[`${table}.${col}`] = "ok";
              }
            } else {
              results.columns[`${table}.${col}`] = "ok";
            }
          }
        }
      }
      const { error: rpcError } = await supabase.rpc("get_dashboard_stats", {
        p_org_id: "test",
        p_month: "2023-01",
        p_last_7_days: ["2023-01-01"]
      });
      if (rpcError && (rpcError.code === "42883" || rpcError.message.includes("Could not find") || rpcError.message.includes("operator does not exist"))) {
        results.sqlFixes.push(`
-- Create RPC for dashboard stats
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_org_id text, p_month text, p_last_7_days text[])
RETURNS json AS $$
DECLARE
    v_total_weekly_minutes bigint;
    v_absences json;
BEGIN
    SELECT COALESCE(SUM(duration_minutes), 0)
    INTO v_total_weekly_minutes
    FROM work_logs
    WHERE organization_id = p_org_id 
      AND date::text = ANY(p_last_7_days)
      AND entry_type = 'WORK';

    SELECT json_agg(t)
    INTO v_absences
    FROM (
        SELECT u.name, COUNT(w.id) as count
        FROM users u
        JOIN work_logs w ON u.id = w.user_id
        WHERE w.organization_id = p_org_id 
          AND w.date::text LIKE p_month || '%'
          AND w.entry_type IN ('SICK', 'VACATION')
        GROUP BY u.id, u.name
        ORDER BY count DESC
        LIMIT 3
    ) t;

    RETURN json_build_object(
        'total_weekly_minutes', v_total_weekly_minutes,
        'top_absences', COALESCE(v_absences, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql;
        `);
      }
      const { error: rpcMonthlyError } = await supabase.rpc("get_monthly_report", {
        p_org_id: "test",
        p_month: "2023-01"
      });
      if (rpcMonthlyError && (rpcMonthlyError.code === "42883" || rpcMonthlyError.message.includes("Could not find") || rpcMonthlyError.message.includes("operator does not exist"))) {
        results.sqlFixes.push(`
-- Create RPC for monthly report
CREATE OR REPLACE FUNCTION get_monthly_report(p_org_id TEXT, p_month TEXT)
RETURNS TABLE (
    user_id TEXT,
    user_name TEXT,
    work_days BIGINT,
    total_minutes BIGINT,
    sick_days BIGINT,
    vacation_days BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id AS user_id,
        u.name AS user_name,
        COUNT(wl.id) FILTER (WHERE wl.entry_type = 'WORK') AS work_days,
        COALESCE(SUM(wl.duration_minutes) FILTER (WHERE wl.entry_type = 'WORK'), 0) AS total_minutes,
        COUNT(wl.id) FILTER (WHERE wl.entry_type = 'SICK') AS sick_days,
        COUNT(wl.id) FILTER (WHERE wl.entry_type = 'VACATION') AS vacation_days
    FROM users u
    LEFT JOIN work_logs wl ON u.id = wl.user_id 
        AND wl.organization_id = p_org_id 
        AND wl.date::text LIKE p_month || '%'
    WHERE u.organization_id = p_org_id
    GROUP BY u.id, u.name;
END;
$$;
        `);
      }
      const { error: rpcUserStatsError } = await supabase.rpc("get_user_stats", {
        p_user_id: "test",
        p_month: "2023-01"
      });
      if (rpcUserStatsError && (rpcUserStatsError.code === "42883" || rpcUserStatsError.message.includes("Could not find") || rpcUserStatsError.message.includes("operator does not exist"))) {
        results.sqlFixes.push(`
-- Create RPC for user stats
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id TEXT, p_month TEXT)
RETURNS TABLE (
    total_work_minutes BIGINT,
    shifts_count BIGINT,
    avg_shift_minutes NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(duration_minutes), 0) as total_work_minutes,
        COUNT(id) as shifts_count,
        COALESCE(AVG(duration_minutes), 0) as avg_shift_minutes
    FROM work_logs
    WHERE user_id = p_user_id 
      AND date::text LIKE p_month || '%'
      AND entry_type = 'WORK';
END;
$$;
        `);
      }
      const hasErrors = Object.values(results.tables).some((t) => t.status === "error") || Object.values(results.columns).some((c) => c === "missing") || results.sqlFixes.length > 0;
      results.status = hasErrors ? "partial" : "ok";
      return results;
    } catch (e) {
      return { ...results, status: "error", message: e.message };
    }
  },
  // Diagnostics
  getDuplicateUsers: async (orgId) => {
    if (!checkConfig()) return [];
    const { data: users, error } = await supabase.from("users").select("id, name, position").eq("organization_id", orgId);
    if (error || !users) return [];
    const nameMap = /* @__PURE__ */ new Map();
    users.forEach((u) => {
      const name = u.name.trim().toLowerCase();
      if (!nameMap.has(name)) nameMap.set(name, []);
      nameMap.get(name)?.push(u);
    });
    const duplicates = [];
    nameMap.forEach((list, name) => {
      if (list.length > 1) {
        duplicates.push({ name: list[0].name, users: list });
      }
    });
    return duplicates;
  },
  getOrphanedLogs: async (orgId) => {
    if (!checkConfig()) return [];
    const { data: users } = await supabase.from("users").select("id").eq("organization_id", orgId);
    const userIds = new Set((users || []).map((u) => u.id));
    const { data: logUserIds, error } = await supabase.from("work_logs").select("user_id").eq("organization_id", orgId);
    if (error || !logUserIds) return [];
    const uniqueLogUserIds = Array.from(new Set(logUserIds.map((l) => l.user_id)));
    const orphanedIds = uniqueLogUserIds.filter((id) => !userIds.has(id));
    return orphanedIds;
  },
  subscribeToChanges: (orgId, table, callback) => {
    if (!isConfigured()) return () => {
    };
    const channel = supabase.channel(`public:${table}:org:${orgId}`).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: table === "organizations" ? `id=eq.${orgId}` : orgId !== "demo_org" ? `organization_id=eq.${orgId}` : void 0
      },
      (payload) => {
        callback(payload);
      }
    ).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
  getPromoCodes: async () => {
    if (!checkConfig()) {
      const cached = localStorage.getItem(STORAGE_KEYS.PROMO_CODES);
      return cached ? JSON.parse(cached) : null;
    }
    const { data, error } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
    if (error) {
      const cached = localStorage.getItem(STORAGE_KEYS.PROMO_CODES);
      return cached ? JSON.parse(cached) : null;
    }
    return data.map((p) => ({
      id: p.id,
      code: p.code,
      planType: p.plan_type,
      durationDays: p.duration_days,
      maxUses: p.max_uses,
      usedCount: p.used_count,
      createdAt: p.created_at,
      expiresAt: p.expires_at,
      isActive: p.is_active,
      lastUsedBy: p.last_used_by,
      lastUsedAt: p.last_used_at
    }));
  },
  savePromoCode: async (promo) => {
    const cached = localStorage.getItem(STORAGE_KEYS.PROMO_CODES);
    let promos = cached ? JSON.parse(cached) : [];
    const index = promos.findIndex((p) => p.id === promo.id);
    if (index >= 0) {
      promos[index] = promo;
    } else {
      promos.unshift(promo);
    }
    localStorage.setItem(STORAGE_KEYS.PROMO_CODES, JSON.stringify(promos));
    if (!checkConfig()) return { error: "Not configured" };
    const payload = {
      id: promo.id,
      code: promo.code,
      plan_type: promo.planType,
      duration_days: promo.durationDays,
      max_uses: promo.maxUses,
      used_count: promo.usedCount,
      created_at: promo.createdAt,
      expires_at: promo.expiresAt,
      is_active: promo.isActive,
      last_used_by: promo.lastUsedBy,
      last_used_at: promo.lastUsedAt
    };
    const { error } = await supabase.from("promo_codes").upsert(payload);
    if (error) {
      console.error("Error saving promo code:", error);
      if (error.code === "42703" || error.code === "PGRST204" || error.message?.includes("column")) {
        console.warn("Retrying promo code save with minimal payload...");
        const minimalPayload = {
          id: promo.id,
          code: promo.code,
          plan_type: promo.planType,
          duration_days: promo.durationDays,
          max_uses: promo.maxUses,
          used_count: promo.usedCount
        };
        const { error: retryError } = await supabase.from("promo_codes").upsert(minimalPayload);
        return { error: retryError };
      }
    }
    return { error };
  },
  deletePromoCode: async (id) => {
    const cached = localStorage.getItem(STORAGE_KEYS.PROMO_CODES);
    if (cached) {
      const promos = JSON.parse(cached);
      const filtered = promos.filter((p) => p.id !== id);
      localStorage.setItem(STORAGE_KEYS.PROMO_CODES, JSON.stringify(filtered));
    }
    if (!checkConfig()) return;
    await supabase.from("promo_codes").delete().eq("id", id);
  },
  deleteOrganization: async (orgId) => {
    if (!checkConfig()) return { error: "Not configured" };
    try {
      await Promise.all([
        supabase.from("users").delete().eq("organization_id", orgId),
        supabase.from("work_logs").delete().eq("organization_id", orgId),
        supabase.from("machines").delete().eq("organization_id", orgId),
        supabase.from("positions").delete().eq("organization_id", orgId),
        supabase.from("active_shifts").delete().eq("organization_id", orgId)
      ]);
      const { error } = await supabase.from("organizations").delete().eq("id", orgId);
      return { error };
    } catch (e) {
      console.error("Error in deleteOrganization:", e);
      return { error: e.message };
    }
  },
  getPayrollSnapshots: async (orgId, month) => {
    if (!checkConfig()) return [];
    const { data, error } = await supabase.from("payroll_snapshots").select("*").eq("organization_id", orgId).eq("month", month);
    if (error) return [];
    return data.map((s) => ({
      id: s.id,
      userId: s.user_id,
      organizationId: s.organization_id,
      month: s.month,
      totalMinutes: s.total_minutes,
      totalSalary: s.total_salary,
      bonuses: s.bonuses,
      fines: s.fines,
      rateUsed: s.rate_used,
      rateType: s.rate_type,
      calculatedAt: s.calculated_at,
      details: s.details
    }));
  },
  savePayrollSnapshot: async (snapshot) => {
    if (!checkConfig()) return { error: "Not configured" };
    const payload = {
      id: snapshot.id,
      user_id: snapshot.userId,
      organization_id: snapshot.organizationId,
      month: snapshot.month,
      total_minutes: snapshot.totalMinutes,
      total_salary: snapshot.totalSalary,
      bonuses: snapshot.bonuses,
      fines: snapshot.fines,
      rate_used: snapshot.rateUsed,
      rate_type: snapshot.rateType,
      calculated_at: snapshot.calculatedAt,
      details: snapshot.details
    };
    const { error } = await supabase.from("payroll_snapshots").upsert(payload);
    return { error };
  },
  getPayments: async (orgId, monthPrefix) => {
    if (!checkConfig()) return [];
    let query = supabase.from("payroll_payments").select("*").eq("organization_id", orgId);
    if (monthPrefix) {
      query = query.like("date", `${monthPrefix}%`);
    }
    const { data, error } = await query.order("date", { ascending: false });
    if (error) {
      if (error.code !== "PGRST205") {
        console.error("Error fetching payroll payments:", error);
      }
      return [];
    }
    return (data || []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      organizationId: p.organization_id,
      amount: p.amount,
      date: p.date,
      type: p.type,
      comment: p.comment,
      createdAt: p.created_at
    }));
  },
  savePayment: async (payment) => {
    if (!checkConfig()) return { error: "Not configured" };
    const payload = {
      id: payment.id,
      user_id: payment.userId,
      organization_id: payment.organizationId,
      amount: payment.amount,
      date: payment.date,
      type: payment.type,
      comment: payment.comment,
      created_at: payment.createdAt
    };
    const { error } = await supabase.from("payroll_payments").upsert(payload);
    if (error && error.code === "PGRST205") {
      return { error: "\u0422\u0430\u0431\u043B\u0438\u0446\u0430 payroll_payments \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0432 \u0431\u0430\u0437\u0435 \u0434\u0430\u043D\u043D\u044B\u0445. \u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0437\u0430\u0439\u0434\u0438\u0442\u0435 \u0432 \u043F\u0430\u043D\u0435\u043B\u044C \u0421\u0443\u043F\u0435\u0440-\u0410\u0434\u043C\u0438\u043D\u0430 -> \u0414\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0430 \u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 SQL-\u0441\u043A\u0440\u0438\u043F\u0442 \u0434\u043B\u044F \u0435\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F." };
    }
    return { error };
  },
  deletePayment: async (id) => {
    if (!checkConfig()) return { error: "Not configured" };
    const { error } = await supabase.from("payroll_payments").delete().eq("id", id);
    if (error && error.code === "PGRST205") {
      return { error: "\u0422\u0430\u0431\u043B\u0438\u0446\u0430 payroll_payments \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0432 \u0431\u0430\u0437\u0435 \u0434\u0430\u043D\u043D\u044B\u0445." };
    }
    return { error };
  },
  getPayrollPeriod: async (orgId, month) => {
    if (!checkConfig()) return null;
    const { data, error } = await supabase.from("payroll_periods").select("*").eq("organization_id", orgId).eq("month", month).maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      organizationId: data.organization_id,
      month: data.month,
      status: data.status,
      closedAt: data.closed_at,
      closedBy: data.closed_by
    };
  },
  savePayrollPeriod: async (period) => {
    if (!checkConfig()) return { error: "Not configured" };
    const payload = {
      id: period.id,
      organization_id: period.organizationId,
      month: period.month,
      status: period.status,
      closed_at: period.closedAt,
      closed_by: period.closedBy
    };
    const { error } = await supabase.from("payroll_periods").upsert(payload);
    if (error && error.code === "PGRST205") {
      return { error: "\u0422\u0430\u0431\u043B\u0438\u0446\u0430 payroll_periods \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0432 \u0431\u0430\u0437\u0435 \u0434\u0430\u043D\u043D\u044B\u0445. \u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0437\u0430\u0439\u0434\u0438\u0442\u0435 \u0432 \u043F\u0430\u043D\u0435\u043B\u044C \u0421\u0443\u043F\u0435\u0440-\u0410\u0434\u043C\u0438\u043D\u0430 -> \u0414\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0430 \u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 SQL-\u0441\u043A\u0440\u0438\u043F\u0442 \u0434\u043B\u044F \u0435\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F." };
    }
    return { error };
  }
};
export {
  checkConfig,
  db,
  supabase
};
