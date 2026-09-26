import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc,
  setDoc,
  deleteDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

type Task = {
  id: string;
  title: string;
  description: string;
  points: number;
  completed: boolean;
  parentId?: string | null;
  createdByRole?: string;
  evidenceUrl?: string;
};

type Habit = {
  id: string;
  title: string;
  frequency: string;
  points: number;
  streak: number;
  lastCompletedDate?: string | null;
};

type Reward = {
  id: string;
  title: string;
  description: string;
  cost: number;
  claimed: boolean;
  approved?: boolean;
  rejected?: boolean;
};

type Agreement = {
  id: string;
  title: string;
  category: "Acuerdo" | "Límite Duro" | "Límite Blando";
  description: string;
  status: "Aceptado" | "En Revisión";
};

type ContractSignature = {
  signedBy: string;
  signedAt: string;
  role: string;
};

type ActivityLog = {
  id: string;
  action: string;
  timestamp: string;
  type: "info" | "reward" | "penalty" | "pause";
};

type DiaryEntry = {
  id: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  timestamp: string;
};

type ChatMessage = {
  id: string;
  senderUid: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  timestamp: string;
};

type UserRole = "Sub" | "Dominante";

type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoUrl?: string;
  bio?: string;
  limitsNote?: string;
};

type Toast = {
  id: number;
  text: string;
  type: "success" | "warning" | "error" | "info";
};

const DYNAMIC_ID = "abc123xyz";

function App() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Sistema de Notificaciones Toast
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (text: string, type: "success" | "warning" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Modo Oscuro / Claro automático según la hora del equipo
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const hour = new Date().getHours();
    return hour < 6 || hour >= 19;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove("light-theme");
    } else {
      document.body.classList.add("light-theme");
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Formulario Auth
  const [isRegistering, setIsRegistering] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [roleInput, setRoleInput] = useState<UserRole>("Sub");
  const [authError, setAuthError] = useState("");

  // Estados de la App
  const [activeTab, setActiveTab] = useState<"dashboard" | "tasks" | "habits" | "rewards" | "agreements" | "contract" | "activity" | "diary" | "chat" | "profile">("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [signatures, setSignatures] = useState<ContractSignature[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newChatText, setNewChatText] = useState("");

  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isObedienteActive, setIsObedienteActive] = useState(false);

  // Estados para Edición de Perfil Ampliado
  const [editBio, setEditBio] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [editLimits, setEditLimits] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];
  const currentRole = userProfile?.role || "Sub";
  const activeUserName = userProfile?.displayName || userProfile?.email || "Usuario";

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const pData = userSnap.data() as UserProfile;
          setUserProfile(pData);
          setEditBio(pData.bio || "");
          setEditPhotoUrl(pData.photoUrl || "");
          setEditLimits(pData.limitsNote || "");
        }
      } else {
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Cargar Firestore
  useEffect(() => {
    if (!user) return;

    const configRef = doc(db, "dynamics", DYNAMIC_ID);
    const tasksRef = collection(db, "dynamics", DYNAMIC_ID, "tasks");
    const habitsRef = collection(db, "dynamics", DYNAMIC_ID, "habits");
    const rewardsRef = collection(db, "dynamics", DYNAMIC_ID, "rewards");
    const agreementsRef = collection(db, "dynamics", DYNAMIC_ID, "agreements");
    const logsRef = collection(db, "dynamics", DYNAMIC_ID, "activityLogs");
    const diaryRef = collection(db, "dynamics", DYNAMIC_ID, "diaryEntries");
    const chatRef = collection(db, "dynamics", DYNAMIC_ID, "chatMessages");

    const unsubConfig = onSnapshot(configRef, (snapshot: any) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setIsPaused(Boolean(data.isPaused));
        setSignatures(data.signatures || []);
      } else {
        setDoc(configRef, { isPaused: false, signatures: [] }, { merge: true });
      }
    });

    const unsubTasks = onSnapshot(tasksRef, (snapshot: any) => {
      const fetchedTasks: Task[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        title: doc.data().title || "",
        description: doc.data().description || "",
        points: Number(doc.data().points) || 0,
        completed: Boolean(doc.data().completed),
        parentId: doc.data().parentId || null,
        createdByRole: doc.data().createdByRole || "Sub",
        evidenceUrl: doc.data().evidenceUrl || ""
      }));
      setTasks(fetchedTasks);
      setLoading(false);
    });

    const unsubHabits = onSnapshot(habitsRef, (snapshot: any) => {
      const fetchedHabits: Habit[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        title: doc.data().title || "",
        frequency: doc.data().frequency || "Diaria",
        points: Number(doc.data().points) || 10,
        streak: Number(doc.data().streak) || 0,
        lastCompletedDate: doc.data().lastCompletedDate || null,
      }));
      setHabits(fetchedHabits);
    });

    const unsubRewards = onSnapshot(rewardsRef, (snapshot: any) => {
      const fetchedRewards: Reward[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        title: doc.data().title || "",
        description: doc.data().description || "",
        cost: Number(doc.data().cost) || 50,
        claimed: Boolean(doc.data().claimed),
        approved: Boolean(doc.data().approved),
        rejected: Boolean(doc.data().rejected)
      }));
      setRewards(fetchedRewards);
    });

    const unsubAgreements = onSnapshot(agreementsRef, (snapshot: any) => {
      const fetchedAgreements: Agreement[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        title: doc.data().title || "",
        category: doc.data().category || "Acuerdo",
        description: doc.data().description || "",
        status: doc.data().status || "Aceptado",
      }));
      setAgreements(fetchedAgreements);
    });

    const unsubLogs = onSnapshot(logsRef, (snapshot: any) => {
      const fetchedLogs: ActivityLog[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        action: doc.data().action || "",
        timestamp: doc.data().timestamp || "",
        type: doc.data().type || "info",
      }));
      fetchedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivityLogs(fetchedLogs);
    });

    const unsubDiary = onSnapshot(diaryRef, (snapshot: any) => {
      const fetchedDiary: DiaryEntry[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        authorName: doc.data().authorName || "",
        authorRole: doc.data().authorRole || "Sub",
        content: doc.data().content || "",
        timestamp: doc.data().timestamp || ""
      }));
      fetchedDiary.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setDiaryEntries(fetchedDiary);
    });

    const unsubChat = onSnapshot(chatRef, (snapshot: any) => {
      const fetchedChat: ChatMessage[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        senderUid: doc.data().senderUid || "",
        senderName: doc.data().senderName || "",
        senderRole: doc.data().senderRole || "Sub",
        text: doc.data().text || "",
        timestamp: doc.data().timestamp || ""
      }));
      fetchedChat.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setChatMessages(fetchedChat);
    });

    return () => {
      unsubConfig();
      unsubTasks();
      unsubHabits();
      unsubRewards();
      unsubAgreements();
      unsubLogs();
      unsubDiary();
      unsubChat();
    };
  }, [user]);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        const newUser = userCredential.user;

        const profileData: UserProfile = {
          uid: newUser.uid,
          email: emailInput,
          displayName: nameInput || emailInput.split("@")[0],
          role: roleInput,
          photoUrl: "",
          bio: "",
          limitsNote: ""
        };

        await setDoc(doc(db, "users", newUser.uid), profileData);
        setUserProfile(profileData);
        showToast("Cuenta creada exitosamente", "success");
      } else {
        await signInWithEmailAndPassword(auth, emailInput, passwordInput);
        showToast("Sesión iniciada correctamente", "success");
      }
    } catch (err: any) {
      setAuthError(err.message || "Error al autenticar");
      showToast("Error en la autenticación", "error");
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    const updatedProfile = {
      ...userProfile,
      bio: editBio,
      photoUrl: editPhotoUrl,
      limitsNote: editLimits
    };
    await setDoc(userDocRef, updatedProfile, { merge: true });
    setUserProfile(updatedProfile as UserProfile);
    showToast("Perfil actualizado correctamente", "success");
  }

  async function handleLogout() {
    await signOut(auth);
    showToast("Sesión cerrada", "info");
  }

  async function logActivity(action: string, type: "info" | "reward" | "penalty" | "pause" = "info") {
    const logsRef = collection(db, "dynamics", DYNAMIC_ID, "activityLogs");
    await addDoc(logsRef, {
      action: `[${currentRole}] ${action}`,
      timestamp: new Date().toLocaleString(),
      type
    });
  }

  async function togglePause() {
    if (currentRole !== "Dominante") {
      alert("Solo el perfil Dominante / Admin puede pausar la dinámica.");
      return;
    }

    const newPauseState = !isPaused;
    const configRef = doc(db, "dynamics", DYNAMIC_ID);
    await setDoc(configRef, { isPaused: newPauseState }, { merge: true });
    await logActivity(
      newPauseState ? "Dinámica colocada en Pausa de Seguridad" : "Dinámica Reanudada", 
      "pause"
    );
    showToast(newPauseState ? "Dinámica en pausa" : "Dinámica reanudada", "warning");
  }

  async function signContract() {
    const timestamp = new Date().toLocaleString();
    const newSignature: ContractSignature = {
      signedBy: activeUserName,
      signedAt: timestamp,
      role: currentRole
    };

    const updatedSignatures = [...signatures, newSignature];
    const configRef = doc(db, "dynamics", DYNAMIC_ID);
    
    await setDoc(configRef, { signatures: updatedSignatures }, { merge: true });
    await logActivity(`El documento marco fue firmado por ${activeUserName} (${currentRole})`, "info");
    showToast("Documento firmado digitalmente con éxito", "success");
  }

  async function handleApplyPenalty() {
    if (currentRole !== "Dominante") {
      alert("Solo el perfil Dominante / Admin puede aplicar penalizaciones.");
      return;
    }

    if (isPaused) {
      alert("No se pueden aplicar penalizaciones mientras la dinámica está en Pausa.");
      return;
    }

    const reason = prompt("Motivo de la penalización / falta:");
    if (!reason) return;
    const penaltyPtsStr = prompt("Puntos a descontar (ej. 20):") || "20";
    const pts = parseInt(penaltyPtsStr, 10) || 0;

    await logActivity(`PENALIZACIÓN aplicada: ${reason} (-${pts} pts)`, "penalty");
    showToast(`Penalización registrada (-${pts} pts)`, "error");
  }

  async function toggleTask(id: string, currentCompletedStatus: boolean) {
    const taskDocRef = doc(db, "dynamics", DYNAMIC_ID, "tasks", id);
    const newStatus = !currentCompletedStatus;
    
    let evidenceUrl = "";
    if (newStatus && currentRole === "Sub") {
      const inputUrl = prompt("¿Deseas adjuntar un enlace de evidencia fotográfica para esta tarea? (Opcional):") || "";
      evidenceUrl = inputUrl;
    }

    await updateDoc(taskDocRef, { 
      completed: newStatus,
      ...(evidenceUrl ? { evidenceUrl } : {})
    });
    
    const task = tasks.find(t => t.id === id);
    if (task && newStatus) {
      await logActivity(`Tarea completada por ${activeUserName}: "${task.title}" (+${task.points} pts)${evidenceUrl ? ' [Con Evidencia]' : ''}`, "info");
      showToast(`¡Tarea completada! +${task.points} pts`, "success");
    }
  }

  async function handleAddTask(parentId: string | null = null) {
    const title = prompt(parentId ? "Título de la Subtarea:" : "Título de la Tarea Principal:");
    if (!title) return;
    const description = prompt("Descripción:") || "";
    const pointsStr = prompt("Puntos:") || "10";

    const tasksRef = collection(db, "dynamics", DYNAMIC_ID, "tasks");
    await addDoc(tasksRef, {
      title,
      description,
      points: parseInt(pointsStr, 10) || 10,
      completed: false,
      parentId,
      createdByRole: currentRole,
      evidenceUrl: ""
    });
    showToast("Tarea agregada correctamente", "success");
  }

  async function handleEditTask(task: Task) {
    if (currentRole === "Sub" && task.createdByRole === "Dominante") {
      alert("Esta tarea fue asignada por el Dominante y no puede ser editada por el Sub.");
      return;
    }

    const newTitle = prompt("Editar Título:", task.title);
    if (newTitle === null) return;
    const newDescription = prompt("Editar Descripción:", task.description) ?? "";
    const newPointsStr = prompt("Editar Puntos:", task.points.toString()) ?? "10";

    const taskRef = doc(db, "dynamics", DYNAMIC_ID, "tasks", task.id);
    await updateDoc(taskRef, {
      title: newTitle || task.title,
      description: newDescription,
      points: parseInt(newPointsStr, 10) || task.points
    });
    showToast("Tarea actualizada", "success");
  }

  async function handleDeleteTask(task: Task) {
    if (currentRole === "Sub" && task.createdByRole === "Dominante") {
      alert("No tienes permiso para borrar tareas asignadas por el Dominante.");
      return;
    }

    if (confirm("¿Estás seguro de que deseas eliminar esta tarea y sus subtareas?")) {
      const subtasks = tasks.filter(t => t.parentId === task.id);
      for (const sub of subtasks) {
        await deleteDoc(doc(db, "dynamics", DYNAMIC_ID, "tasks", sub.id));
      }
      await deleteDoc(doc(db, "dynamics", DYNAMIC_ID, "tasks", task.id));
      showToast("Tarea eliminada", "info");
    }
  }

  async function handleAddHabit() {
    const title = prompt("Título del hábito:");
    if (!title) return;
    const pointsStr = prompt("Puntos por cumplimiento diario:") || "10";

    const habitsRef = collection(db, "dynamics", DYNAMIC_ID, "habits");
    await addDoc(habitsRef, {
      title,
      frequency: "Diaria",
      points: parseInt(pointsStr, 10) || 10,
      streak: 0,
      lastCompletedDate: null
    });
    showToast("Hábito creado", "success");
  }

  async function handleEditHabit(habit: Habit) {
    const newTitle = prompt("Editar Título del Hábito:", habit.title);
    if (newTitle === null) return;
    const newPointsStr = prompt("Editar Puntos por día:", habit.points.toString()) ?? "10";

    const habitRef = doc(db, "dynamics", DYNAMIC_ID, "habits", habit.id);
    await updateDoc(habitRef, {
      title: newTitle || habit.title,
      points: parseInt(newPointsStr, 10) || habit.points
    });
    showToast("Hábito actualizado", "success");
  }

  async function handleDeleteHabit(habitId: string) {
    if (confirm("¿Eliminar este hábito? Perderás el registro de racha asociado.")) {
      await deleteDoc(doc(db, "dynamics", DYNAMIC_ID, "habits", habitId));
      showToast("Hábito eliminado", "info");
    }
  }

  async function toggleHabitToday(habit: Habit) {
    const isCompletedToday = habit.lastCompletedDate === todayStr;
    const habitRef = doc(db, "dynamics", DYNAMIC_ID, "habits", habit.id);

    if (isCompletedToday) {
      await updateDoc(habitRef, {
        lastCompletedDate: null,
        streak: Math.max(0, habit.streak - 1)
      });
      showToast("Hábito desmarcado", "info");
    } else {
      await updateDoc(habitRef, {
        lastCompletedDate: todayStr,
        streak: habit.streak + 1
      });
      await logActivity(`Hábito cumplido por ${activeUserName}: "${habit.title}" (Racha: ${habit.streak + 1} 🔥)`, "info");
      showToast(`¡Hábito registrado! Racha: ${habit.streak + 1} 🔥`, "success");
    }
  }

  async function handleAddReward() {
    const title = prompt("Nombre de la Recompensa:");
    if (!title) return;
    const description = prompt("Descripción:") || "";
    const costStr = prompt("Costo en Puntos:") || "50";

    const rewardsRef = collection(db, "dynamics", DYNAMIC_ID, "rewards");
    await addDoc(rewardsRef, {
      title,
      description,
      cost: parseInt(costStr, 10) || 50,
      claimed: false,
      approved: false,
      rejected: false
    });
    showToast("Recompensa agregada al catálogo", "success");
  }

  async function handleEditReward(reward: Reward) {
    const newTitle = prompt("Editar Título:", reward.title);
    if (newTitle === null) return;
    const newDescription = prompt("Editar Descripción:", reward.description) ?? "";
    const newCostStr = prompt("Editar Costo en Puntos:", reward.cost.toString()) ?? "50";

    const rewardRef = doc(db, "dynamics", DYNAMIC_ID, "rewards", reward.id);
    await updateDoc(rewardRef, {
      title: newTitle || reward.title,
      description: newDescription,
      cost: parseInt(newCostStr, 10) || reward.cost
    });
    showToast("Recompensa actualizada", "success");
  }

  async function handleDeleteReward(rewardId: string) {
    if (confirm("¿Deseas eliminar esta recompensa del catálogo?")) {
      await deleteDoc(doc(db, "dynamics", DYNAMIC_ID, "rewards", rewardId));
      showToast("Recompensa eliminada", "info");
    }
  }

  async function requestClaimReward(reward: Reward) {
    if (availablePoints < reward.cost) {
      alert(`Puntos insuficientes. Necesitas ${reward.cost} pts y tienes ${availablePoints} pts.`);
      showToast("Puntos insuficientes para este canje", "error");
      return;
    }

    if (confirm(`¿Deseas solicitar el canje de "${reward.title}" por ${reward.cost} puntos?`)) {
      const rewardRef = doc(db, "dynamics", DYNAMIC_ID, "rewards", reward.id);
      await updateDoc(rewardRef, { claimed: true, approved: false, rejected: false });
      await logActivity(`Solicitud de canje: "${reward.title}" (${reward.cost} pts)`, "reward");
      showToast("Solicitud de canje enviada al Dominante", "warning");
    }
  }

  async function approveReward(reward: Reward) {
    if (currentRole !== "Dominante") return;
    const rewardRef = doc(db, "dynamics", DYNAMIC_ID, "rewards", reward.id);
    await updateDoc(rewardRef, { approved: true, rejected: false });
    await logActivity(`Canje APROBADO por Admin: "${reward.title}" (-${reward.cost} pts)`, "reward");
    showToast(`Canje aprobado: "${reward.title}"`, "success");
  }

  async function rejectReward(reward: Reward) {
    if (currentRole !== "Dominante") return;
    const rewardRef = doc(db, "dynamics", DYNAMIC_ID, "rewards", reward.id);
    await updateDoc(rewardRef, { claimed: false, approved: false, rejected: true });
    await logActivity(`Canje RECHAZADO por Admin: "${reward.title}"`, "reward");
    showToast(`Canje rechazado: "${reward.title}"`, "error");
  }

  async function handleAddAgreement() {
    const title = prompt("Título del acuerdo o límite:");
    if (!title) return;
    const category = prompt("Categoría: Escribe 'Acuerdo', 'Límite Duro' o 'Límite Blando'") as any;
    const description = prompt("Detalles o términos:") || "";

    const validCategory = ["Acuerdo", "Límite Duro", "Límite Blando"].includes(category) 
      ? category 
      : "Acuerdo";

    const agreementsRef = collection(db, "dynamics", DYNAMIC_ID, "agreements");
    await addDoc(agreementsRef, {
      title,
      category: validCategory,
      description,
      status: "Aceptado"
    });
    await logActivity(`Nuevo ${validCategory} registrado: "${title}"`, "info");
    showToast("Acuerdo/Límite registrado", "success");
  }

  async function handleEditAgreement(agreement: Agreement) {
    if (currentRole !== "Dominante") {
      alert("Solo el perfil Dominante / Admin puede editar acuerdos formalizados.");
      return;
    }

    const newTitle = prompt("Editar Título del Acuerdo/Límite:", agreement.title);
    if (newTitle === null) return;
    const newCategory = prompt("Categoría ('Acuerdo', 'Límite Duro', 'Límite Blando'):", agreement.category) as any;
    const newDescription = prompt("Editar Detalles:", agreement.description) ?? "";

    const validCategory = ["Acuerdo", "Límite Duro", "Límite Blando"].includes(newCategory) 
      ? newCategory 
      : agreement.category;

    const agreementRef = doc(db, "dynamics", DYNAMIC_ID, "agreements", agreement.id);
    await updateDoc(agreementRef, {
      title: newTitle || agreement.title,
      category: validCategory,
      description: newDescription
    });
    showToast("Acuerdo actualizado", "success");
  }

  async function handleDeleteAgreement(agreementId: string) {
    if (currentRole !== "Dominante") {
      alert("Solo el perfil Dominante / Admin puede eliminar acuerdos formalizados.");
      return;
    }

    if (confirm("¿Estás seguro de borrar este acuerdo o límite del registro?")) {
      await deleteDoc(doc(db, "dynamics", DYNAMIC_ID, "agreements", agreementId));
      showToast("Acuerdo eliminado", "info");
    }
  }

  async function handleAddDiaryEntry() {
    const content = prompt("Escribe tu entrada en el diario compartido:");
    if (!content) return;

    const diaryRef = collection(db, "dynamics", DYNAMIC_ID, "diaryEntries");
    await addDoc(diaryRef, {
      authorName: activeUserName,
      authorRole: currentRole,
      content,
      timestamp: new Date().toLocaleString()
    });
    showToast("Entrada agregada al diario", "success");
  }

  async function handleSendChatMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newChatText.trim()) return;

    const chatRef = collection(db, "dynamics", DYNAMIC_ID, "chatMessages");
    await addDoc(chatRef, {
      senderUid: user.uid,
      senderName: activeUserName,
      senderRole: currentRole,
      text: newChatText,
      timestamp: new Date().toISOString()
    });
    setNewChatText("");
  }

  const completedTasksCount = tasks.filter(t => t.completed).length;
  const completedHabitsTodayCount = habits.filter(h => h.lastCompletedDate === todayStr).length;
  
  const taskPoints = tasks.filter(t => t.completed).reduce((acc, t) => acc + t.points, 0);
  const habitPoints = habits.filter(h => h.lastCompletedDate === todayStr).reduce((acc, h) => acc + h.points, 0);
  
  const penaltyPoints = activityLogs
    .filter(log => log.type === "penalty")
    .reduce((acc, log) => {
      const match = log.action.match(/-(\d+)\s*pts/);
      return acc + (match ? parseInt(match[1], 10) : 0);
    }, 0);

  const grossPoints = taskPoints + habitPoints;
  const spentPoints = rewards.filter(r => r.claimed && r.approved).reduce((acc, r) => acc + r.cost, 0);
  const availablePoints = Math.max(0, grossPoints - spentPoints - penaltyPoints);
  const totalEarnedHistorical = grossPoints;

  const maxStreak = habits.length > 0 ? Math.max(...habits.map(h => h.streak)) : 0;
  
  const totalItemsToday = tasks.length + habits.length;
  const totalCompletedToday = completedTasksCount + completedHabitsTodayCount;

  const getSubRank = (points: number, streak: number) => {
    if (points >= 300 || streak >= 14) return { rank: "Maestro Devoto", color: "#ffd700", icon: "👑" };
    if (points >= 150 || streak >= 7) return { rank: "Constante", color: "#55ff88", icon: "⭐" };
    if (points >= 50 || streak >= 3) return { rank: "Disciplinado", color: "#55bbff", icon: "🛡️" };
    return { rank: "Novicio", color: "var(--text-muted)", icon: "🌱" };
  };

  const currentRankInfo = getSubRank(totalEarnedHistorical, maxStreak);

  const badgesList = [
    { id: "b1", title: "Novicio", desc: "Primeros pasos en la dinámica", icon: "🌱", unlocked: totalEarnedHistorical >= 0 },
    { id: "b2", title: "Disciplina I", desc: "Alcanza 50 puntos acumulados", icon: "🛡️", unlocked: totalEarnedHistorical >= 50 },
    { id: "b3", title: "Constante", desc: "Mantén una racha de 7 días", icon: "⭐", unlocked: maxStreak >= 7 },
    { id: "b4", title: "Devoto", desc: "Supera los 300 puntos acumulados", icon: "👑", unlocked: totalEarnedHistorical >= 300 }
  ];

  const rootTasks = tasks.filter(t => !t.parentId);
  const getSubtasks = (parentId: string) => tasks.filter(t => t.parentId === parentId);
  const pendingRewards = rewards.filter(r => r.claimed && !r.approved);

  const getNextObedienteTask = (): Task | null => {
    const pending = tasks.filter(t => !t.completed);
    if (pending.length === 0) return null;
    const leaves = pending.filter(p => !tasks.some(child => child.parentId === p.id && !child.completed));
    return leaves[0] || pending[0];
  };

  const currentObedienteTask = getNextObedienteTask();

  if (authLoading) {
    return (
      <div className="app-shell" style={{ justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--text-sub)" }}>Cargando sesión...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-shell" style={{ justifyContent: "center", alignItems: "center", padding: "20px" }}>
        <main style={{ maxWidth: "420px", width: "100%" }}>
          <div className="welcome-card" style={{ flexDirection: "column", padding: "32px", gap: "20px" }}>
            <div style={{ textAlign: "center" }}>
              <div className="brand-mark" style={{ margin: "0 auto 12px auto" }}>D</div>
              <h2 style={{ margin: 0 }}>{isRegistering ? "Crear Cuenta" : "Iniciar Sesión"}</h2>
              <p style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "4px" }}>Espacio Privado Dinámico</p>
            </div>

            {authError && (
              <div style={{ background: "#2c1717", border: "1px solid #a04848", color: "#ff8888", padding: "10px", borderRadius: "8px", fontSize: "12px" }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {isRegistering && (
                <div>
                  <label style={{ fontSize: "12px", color: "var(--accent-text)", display: "block", marginBottom: "4px" }}>Nombre de Usuario</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ej. Alex"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    style={{ width: "100%", padding: "10px", background: "var(--bg-main)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)" }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: "12px", color: "var(--accent-text)", display: "block", marginBottom: "4px" }}>Correo Electrónico</label>
                <input 
                  type="email" 
                  required 
                  placeholder="tu@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  style={{ width: "100%", padding: "10px", background: "var(--bg-main)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "var(--accent-text)", display: "block", marginBottom: "4px" }}>Contraseña</label>
                <input 
                  type="password" 
                  required 
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ width: "100%", padding: "10px", background: "var(--bg-main)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)" }}
                />
              </div>

              {isRegistering && (
                <div>
                  <label style={{ fontSize: "12px", color: "var(--accent-text)", display: "block", marginBottom: "4px" }}>Rol Asignado</label>
                  <select 
                    value={roleInput} 
                    onChange={(e) => setRoleInput(e.target.value as UserRole)}
                    style={{ width: "100%", padding: "10px", background: "var(--bg-main)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)" }}
                  >
                    <option value="Sub">Sub</option>
                    <option value="Dominante">Dominante / Admin</option>
                  </select>
                </div>
              )}

              <button 
                type="submit" 
                className="secondary-button" 
                style={{ background: "var(--accent-primary)", color: "#fff", borderColor: "var(--accent-primary)", fontWeight: "bold", padding: "12px", marginTop: "8px", cursor: "pointer", justifyContent: "center" }}
              >
                {isRegistering ? "Registrarse" : "Entrar"}
              </button>
            </form>

            <button 
              className="secondary-button" 
              style={{ background: "transparent", borderColor: "transparent", color: "var(--text-muted)", fontSize: "13px" }}
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError("");
              }}
            >
              {isRegistering ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate aquí"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (isObedienteActive) {
    return (
      <div className="app-shell" style={{ justifyContent: "center", alignItems: "center", padding: "20px" }}>
        <main style={{ maxWidth: "600px", width: "100%", textAlign: "center" }}>
          <div className="welcome-card" style={{ flexDirection: "column", gap: "24px", padding: "40px 30px" }}>
            <span className="status-pill" style={{ background: "var(--accent-bg)", borderColor: "var(--accent-primary)" }}>
              ⚡ MODO OBEDIENTE ACTIVO ({currentRole.toUpperCase()})
            </span>

            {currentObedienteTask ? (
              <>
                <div>
                  <p className="eyebrow">{currentObedienteTask.parentId ? "SUBTAREA EN CURSO" : "TAREA PRINCIPAL"}</p>
                  <h1 style={{ fontSize: "36px", margin: "10px 0", color: "var(--text-main)" }}>{currentObedienteTask.title}</h1>
                  <p style={{ color: "var(--text-sub)", fontSize: "16px" }}>{currentObedienteTask.description}</p>
                </div>

                <div style={{ background: "var(--bg-card)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
                  <span style={{ color: "var(--accent-text)", fontWeight: "bold" }}>Recompensa: +{currentObedienteTask.points} Puntos</span>
                </div>

                <button 
                  className="secondary-button" 
                  style={{ background: "var(--accent-text)", color: "var(--bg-main)", fontWeight: "bold", padding: "16px 28px", fontSize: "16px", borderRadius: "12px", cursor: "pointer", width: "100%", justifyContent: "center" }}
                  onClick={() => toggleTask(currentObedienteTask.id, false)}
                >
                  ✓ Completar y Siguiente
                </button>
              </>
            ) : (
              <div>
                <h2>✨ ¡Todas las tareas completadas!</h2>
                <p style={{ color: "var(--text-sub)" }}>No hay más tareas pendientes por ejecutar.</p>
              </div>
            )}

            <button 
              className="secondary-button" 
              style={{ background: "transparent", borderColor: "var(--border-hover)", color: "var(--text-muted)", width: "100%", justifyContent: "center" }}
              onClick={() => setIsObedienteActive(false)}
            >
              ← Salir al Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Contenedor de Notificaciones Toast Flotantes */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-message ${toast.type}`}>
            <span>
              {toast.type === "success" ? "✓" : toast.type === "warning" ? "⚠" : toast.type === "error" ? "✕" : "ℹ"}
            </span>
            <span>{toast.text}</span>
          </div>
        ))}
      </div>

      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark">D</div>
            <div>
              <strong>DYNAMIC</strong>
              <span>PRIVATE SPACE</span>
            </div>
          </div>

          <button 
            onClick={toggleTheme} 
            className="secondary-button" 
            style={{ width: "100%", marginBottom: "20px", justifyContent: "center", display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold" }}
            title="Cambiar preferencia de estilo"
          >
            {isDarkMode ? "🌙 Modo Oscuro" : "☀️ Modo Claro"}
          </button>

          {/* Iconografía monocromática y minimalista de trazo SVG puro */}
          <nav className="navigation">
            <button className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
              </span> 
              Dashboard
            </button>

            <button className={`nav-item ${activeTab === "tasks" ? "active" : ""}`} onClick={() => setActiveTab("tasks")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </span> 
              Tareas
            </button>

            <button className={`nav-item ${activeTab === "habits" ? "active" : ""}`} onClick={() => setActiveTab("habits")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </span> 
              Hábitos
            </button>

            <button className={`nav-item ${activeTab === "rewards" ? "active" : ""}`} onClick={() => setActiveTab("rewards")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
              </span> 
              Recompensas {pendingRewards.length > 0 && <span style={{ background: "var(--accent-primary)", color: "#fff", padding: "2px 6px", borderRadius: "8px", fontSize: "10px", marginLeft: "auto" }}>{pendingRewards.length}</span>}
            </button>

            <button className={`nav-item ${activeTab === "agreements" ? "active" : ""}`} onClick={() => setActiveTab("agreements")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </span> 
              Acuerdos y Límites
            </button>

            <button className={`nav-item ${activeTab === "diary" ? "active" : ""}`} onClick={() => setActiveTab("diary")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              </span> 
              Diario Compartido
            </button>

            <button className={`nav-item ${activeTab === "chat" ? "active" : ""}`} onClick={() => setActiveTab("chat")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </span> 
              Chat Directo
            </button>

            <button className={`nav-item ${activeTab === "contract" ? "active" : ""}`} onClick={() => setActiveTab("contract")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </span> 
              Contrato Digital
            </button>

            <button className={`nav-item ${activeTab === "activity" ? "active" : ""}`} onClick={() => setActiveTab("activity")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </span> 
              Registro de Actividad
            </button>

            <button className={`nav-item ${activeTab === "profile" ? "active" : ""}`} onClick={() => setActiveTab("profile")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </span> 
              Perfil Ampliado
            </button>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <button className="nav-item" onClick={handleLogout} style={{ color: "var(--text-sub)", width: "100%" }}>
            <span className="nav-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </span> 
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ESPACIO PRIVADO</p>
            <h1>Nuestra dinámica</h1>
          </div>

          <div className="profile" style={{ gap: "12px", cursor: "pointer" }} onClick={() => setActiveTab("profile")}>
            <div className="avatar" style={{ background: currentRole === "Dominante" ? "var(--accent-primary)" : "var(--border-color)", overflow: "hidden" }}>
              {userProfile?.photoUrl ? (
                <img src={userProfile.photoUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                currentRole === "Sub" ? "S" : "D"
              )}
            </div>
            <div>
              <strong style={{ color: "var(--text-main)" }}>{activeUserName}</strong>
              <div style={{ fontSize: "11px", color: "var(--accent-text)", marginTop: "2px" }}>
                Rol: {currentRole} • Rango: <span style={{ color: currentRankInfo.color, fontWeight: "bold" }}>{currentRankInfo.icon} {currentRankInfo.rank}</span>
              </div>
            </div>
          </div>
        </header>

        {currentRole === "Dominante" && pendingRewards.length > 0 && (
          <section className="welcome-card" style={{ borderColor: "var(--border-hover)", background: isDarkMode ? "var(--bg-card)" : "var(--bg-card)", marginBottom: "20px" }}>
            <div>
              <p className="eyebrow" style={{ color: "var(--accent-text)" }}>SOLICITUDES PENDIENTES</p>
              <h2 style={{ color: "var(--text-main)" }}>Buzón de Canjes por Aprobar ({pendingRewards.length})</h2>
              <p style={{ color: "var(--text-sub)" }}>El Sub ha solicitado canjear las siguientes recompensas:</p>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", marginTop: "12px" }}>
              {pendingRewards.map((reward) => (
                <div key={reward.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-main)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                  <div>
                    <strong style={{ color: "var(--text-main)" }}>{reward.title}</strong>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Costo: {reward.cost} pts</div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="secondary-button" style={{ background: "var(--accent-primary)", color: "#fff" }} onClick={() => approveReward(reward)}>
                      Aprobar
                    </button>
                    <button className="secondary-button" style={{ background: "transparent", color: "var(--text-sub)" }} onClick={() => rejectReward(reward)}>
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="welcome-card" style={{ borderColor: isPaused ? "var(--accent-primary)" : "var(--border-color)" }}>
          <div>
            <p className="eyebrow">{isPaused ? "SISTEMA EN PAUSA" : "HOY"}</p>
            <h2>{isPaused ? "Dinámica Suspendida Temporalmente" : "Tu espacio de progreso"}</h2>
            <p>
              {isPaused 
                ? "Las consecuencias y la pérdida de rachas están desactivadas por pausa de dinámica." 
                : "Gestiona tareas, hábitos, puntos, acuerdos y objetivos desde un único lugar."}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
            <div className="status-pill" style={{ background: "var(--accent-bg)", borderColor: "var(--accent-primary)", color: "var(--accent-text)" }}>
              <span className="status-dot" style={{ background: isPaused ? "var(--text-muted)" : "var(--accent-primary)" }}></span>
              {isPaused ? "Pausa Activada" : "Dinámica Activa"}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button 
                className="secondary-button"
                style={{ background: "var(--bg-hover)", color: "var(--text-main)", borderColor: "var(--border-hover)" }}
                onClick={togglePause}
              >
                {isPaused ? "Reanudar Dinámica" : "Pausa de Dinámica"}
              </button>

              <button 
                className="secondary-button"
                style={{ background: "var(--accent-primary)", color: "#ffffff", borderColor: "var(--accent-primary)", fontWeight: "bold" }}
                onClick={() => setIsObedienteActive(true)}
              >
                ⚡ Modo Obediente
              </button>
            </div>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <span>COMPLETADOS</span>
            <strong>{totalCompletedToday}</strong>
            <small>de {totalItemsToday} ítems hoy</small>
          </div>

          <div className="stat-card">
            <span>PUNTOS DISPONIBLES</span>
            <strong>{availablePoints}</strong>
            <small>gastados: {spentPoints} | pen: -{penaltyPoints}</small>
          </div>

          <div className="stat-card">
            <span>MÁXIMA RACHA</span>
            <strong>{maxStreak} 🔥</strong>
            <small>días consecutivos</small>
          </div>

          <div className="stat-card">
            <span>RANGO ACTUAL</span>
            <strong style={{ color: currentRankInfo.color }}>{currentRankInfo.icon} {currentRankInfo.rank}</strong>
            <small>nivel automático</small>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel">
            {activeTab === "profile" ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">CONFIGURACIÓN DE IDENTIDAD</p>
                    <h2>Perfil Ampliado y Fotografía</h2>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ fontSize: "12px", color: "var(--accent-text)", display: "block", marginBottom: "4px" }}>URL de Fotografía de Perfil</label>
                    <input 
                      type="url" 
                      placeholder="https://ejemplo.com/mi-foto.jpg"
                      value={editPhotoUrl}
                      onChange={(e) => setEditPhotoUrl(e.target.value)}
                      style={{ width: "100%", padding: "10px", background: "var(--bg-main)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "12px", color: "var(--accent-text)", display: "block", marginBottom: "4px" }}>Biografía o Descripción Personal</label>
                    <textarea 
                      rows={3}
                      placeholder="Breve descripción o intenciones dentro de la dinámica..."
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      style={{ width: "100%", padding: "10px", background: "var(--bg-main)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)", resize: "vertical" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "12px", color: "var(--accent-text)", display: "block", marginBottom: "4px" }}>Límites y Notas Especiales de Perfil</label>
                    <textarea 
                      rows={2}
                      placeholder="Preferencias o restricciones particulares..."
                      value={editLimits}
                      onChange={(e) => setEditLimits(e.target.value)}
                      style={{ width: "100%", padding: "10px", background: "var(--bg-main)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)", resize: "vertical" }}
                    />
                  </div>

                  <button type="submit" className="secondary-button" style={{ background: "var(--accent-primary)", color: "#fff", fontWeight: "bold", padding: "12px", justifyContent: "center" }}>
                    Guardar Cambios de Perfil
                  </button>
                </form>
              </>
            ) : activeTab === "chat" ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">COMUNICACIÓN DIRECTA</p>
                    <h2>Chat de la Dinámica</h2>
                  </div>
                </div>

                <div className="chat-container">
                  <div className="chat-messages">
                    {chatMessages.length === 0 ? (
                      <p style={{ color: "var(--text-muted)", textAlign: "center", marginTop: "40px" }}>No hay mensajes en el chat todavía. ¡Inicia la conversación!</p>
                    ) : (
                      chatMessages.map((msg) => {
                        const isMine = msg.senderUid === user.uid;
                        return (
                          <div key={msg.id} className={`chat-bubble ${isMine ? "mine" : "theirs"}`}>
                            <div style={{ fontSize: "10px", opacity: 0.8, marginBottom: "2px", fontWeight: "bold" }}>
                              {msg.senderName} ({msg.senderRole})
                            </div>
                            <div>{msg.text}</div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form onSubmit={handleSendChatMessage} className="chat-input-area">
                    <input 
                      type="text" 
                      placeholder="Escribe un mensaje..."
                      value={newChatText}
                      onChange={(e) => setNewChatText(e.target.value)}
                      style={{ flex: 1, padding: "10px", background: "var(--bg-card)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)" }}
                    />
                    <button type="submit" className="secondary-button" style={{ background: "var(--accent-primary)", color: "#fff", fontWeight: "bold" }}>
                      Enviar
                    </button>
                  </form>
                </div>
              </>
            ) : activeTab === "diary" ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">BITÁCORA MUTUA</p>
                    <h2>Diario Compartido</h2>
                  </div>
                  <button className="secondary-button" onClick={handleAddDiaryEntry}>+ Nueva Entrada</button>
                </div>

                {diaryEntries.length === 0 ? (
                  <p style={{ color: "var(--text-muted)" }}>Aún no hay entradas en el diario compartido.</p>
                ) : (
                  <div>
                    {diaryEntries.map((entry) => (
                      <div key={entry.id} className="diary-entry-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <div>
                            <strong style={{ color: "var(--text-main)" }}>{entry.authorName}</strong>
                            <span style={{ fontSize: "11px", marginLeft: "8px", background: "var(--accent-bg)", color: "var(--accent-text)", padding: "2px 6px", borderRadius: "4px" }}>
                              {entry.authorRole}
                            </span>
                          </div>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{entry.timestamp}</span>
                        </div>
                        <p style={{ color: "var(--text-sub)", whiteSpace: "pre-wrap", margin: 0, fontSize: "14px", lineHeight: "1.5" }}>{entry.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : activeTab === "activity" ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">AUDITORÍA DE EVENTOS</p>
                    <h2>Historial de Actividad</h2>
                  </div>
                  {currentRole === "Dominante" && (
                    <button className="secondary-button" style={{ background: "var(--bg-hover)", color: "var(--text-main)" }} onClick={handleApplyPenalty}>
                      Aplicar Penalización
                    </button>
                  )}
                </div>

                {activityLogs.length === 0 ? (
                  <p style={{ color: "var(--text-muted)" }}>No hay registros de actividad aún.</p>
                ) : (
                  <div className="task-list">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="task-card">
                        <div className="task-information">
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ background: "var(--accent-bg)", color: "var(--accent-text)", fontSize: "10px", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                              {log.type.toUpperCase()}
                            </span>
                            <strong style={{ color: "var(--text-main)" }}>{log.action}</strong>
                          </div>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{log.timestamp}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : activeTab === "contract" ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">DOCUMENTO CONSOLIDADO</p>
                    <h2>Contrato de Acuerdos</h2>
                  </div>
                  <button className="secondary-button" style={{ background: "var(--accent-primary)", color: "#fff" }} onClick={signContract}>
                    Firmar como {activeUserName}
                  </button>
                </div>

                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "24px", color: "var(--text-sub)", lineHeight: "1.6" }}>
                  <h3 style={{ marginTop: 0, color: "var(--text-main)", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                    Acuerdo Marco de Dinámica
                  </h3>
                  
                  <p>Este documento consolida todos los acuerdos, límites y reglas aceptadas mutuamente para la dinámica activa.</p>

                  <h4 style={{ color: "var(--accent-text)", marginTop: "20px" }}>1. Términos y Acuerdos Registrados:</h4>
                  {agreements.length === 0 ? (
                    <p style={{ color: "var(--text-muted)" }}>No hay acuerdos registrados actualmente.</p>
                  ) : (
                    <ul style={{ paddingLeft: "20px" }}>
                      {agreements.map((a) => (
                        <li key={a.id} style={{ marginBottom: "8px" }}>
                          <strong style={{ color: "var(--text-main)" }}>[{a.category}] {a.title}:</strong> {a.description || "Sin descripción adicional"}
                        </li>
                      ))}
                    </ul>
                  )}

                  <h4 style={{ color: "var(--accent-text)", marginTop: "20px" }}>2. Firmas Digitales Registradas:</h4>
                  {signatures.length === 0 ? (
                    <p style={{ color: "var(--text-muted)" }}>Aún no hay firmas registradas en este documento.</p>
                  ) : (
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "10px" }}>
                      {signatures.map((sig, idx) => (
                        <div key={idx} style={{ background: "var(--bg-main)", border: "1px dashed var(--accent-primary)", padding: "10px 16px", borderRadius: "8px", fontSize: "12px" }}>
                          <span style={{ color: "var(--accent-text)", fontWeight: "bold" }}>Firmado Digitalmente</span>
                          <div><strong style={{ color: "var(--text-main)" }}>Por:</strong> {sig.signedBy} ({sig.role})</div>
                          <div style={{ color: "var(--text-muted)" }}><strong>Fecha:</strong> {sig.signedAt}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : activeTab === "agreements" ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">CONSENTIMIENTO Y MARCO</p>
                    <h2>Acuerdos y Límites</h2>
                  </div>
                  <button className="secondary-button" onClick={handleAddAgreement}>+ Nuevo Registro</button>
                </div>

                {agreements.length === 0 ? (
                  <p style={{ color: "var(--text-muted)" }}>No hay acuerdos o límites definidos aún.</p>
                ) : (
                  <div className="task-list">
                    {agreements.map((agreement) => (
                      <div key={agreement.id} className="task-card">
                        <div className="task-information">
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ background: "var(--accent-bg)", color: "var(--accent-text)", fontSize: "10px", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                              {agreement.category}
                            </span>
                            <strong>{agreement.title}</strong>
                          </div>
                          <span>{agreement.description || "Sin especificaciones adicionales"}</span>
                        </div>
                        
                        {currentRole === "Dominante" && (
                          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                            <button className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleEditAgreement(agreement)} title="Editar">
                              ✎
                            </button>
                            <button className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px", color: "var(--text-muted)" }} onClick={() => handleDeleteAgreement(agreement.id)} title="Eliminar">
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : activeTab === "rewards" ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">CATÁLOGO</p>
                    <h2>Recompensas Disponibles</h2>
                  </div>
                  <button className="secondary-button" onClick={handleAddReward}>+ Nueva Recompensa</button>
                </div>

                {rewards.length === 0 ? (
                  <p style={{ color: "var(--text-muted)" }}>No hay recompensas creadas aún.</p>
                ) : (
                  <div className="task-list">
                    {rewards.map((reward) => (
                      <div key={reward.id} className={`task-card ${reward.claimed && reward.approved ? "completed" : ""}`}>
                        <div className="task-information">
                          <strong>{reward.title}</strong>
                          <span>{reward.description || "Sin descripción"}</span>
                        </div>

                        <div className="task-points" style={{ marginRight: "12px" }}>
                          {reward.cost} pts
                        </div>

                        <div style={{ display: "flex", gap: "4px", marginRight: "8px" }}>
                          <button className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleEditReward(reward)} title="Editar">
                            ✎
                          </button>
                          <button className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px", color: "var(--text-muted)" }} onClick={() => handleDeleteReward(reward.id)} title="Eliminar">
                            ✕
                          </button>
                        </div>

                        {!reward.claimed ? (
                          <button 
                            className="secondary-button"
                            onClick={() => requestClaimReward(reward)}
                            style={{ background: "var(--accent-primary)", color: "#ffffff", borderColor: "var(--accent-primary)" }}
                          >
                            Solicitar
                          </button>
                        ) : reward.approved ? (
                          <span style={{ color: "var(--accent-text)", fontSize: "12px", fontWeight: "bold" }}>Canjeada</span>
                        ) : currentRole === "Dominante" ? (
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button 
                              className="secondary-button"
                              onClick={() => approveReward(reward)}
                              style={{ background: "var(--accent-primary)", color: "#ffffff", fontWeight: "bold", fontSize: "11px" }}
                            >
                              Aprobar
                            </button>
                            <button 
                              className="secondary-button"
                              onClick={() => rejectReward(reward)}
                              style={{ fontSize: "11px" }}
                            >
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Pendiente</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : activeTab === "habits" ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">SEGUIMIENTO DIARIO</p>
                    <h2>Hábitos Recurrentes</h2>
                  </div>
                  <button className="secondary-button" onClick={handleAddHabit}>+ Nuevo hábito</button>
                </div>

                {habits.length === 0 ? (
                  <p style={{ color: "var(--text-muted)" }}>No hay hábitos configurados aún.</p>
                ) : (
                  <div className="task-list">
                    {habits.map((habit) => {
                      const isDoneToday = habit.lastCompletedDate === todayStr;
                      return (
                        <div key={habit.id} className={`task-card ${isDoneToday ? "completed" : ""}`}>
                          <button className="check-button" onClick={() => toggleHabitToday(habit)}>
                            {isDoneToday ? "✓" : ""}
                          </button>
                          <div className="task-information">
                            <strong>{habit.title}</strong>
                            <span>Frecuencia: {habit.frequency} • Racha: {habit.streak} 🔥</span>
                          </div>
                          
                          <div className="task-points" style={{ marginRight: "8px" }}>+{habit.points}</div>

                          <div style={{ display: "flex", gap: "4px" }}>
                            <button className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleEditHabit(habit)} title="Editar">
                              ✎
                            </button>
                            <button className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px", color: "var(--text-muted)" }} onClick={() => handleDeleteHabit(habit.id)} title="Eliminar">
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">PLAN DE HOY</p>
                    <h2>Tareas y Subtareas</h2>
                  </div>
                  <button className="secondary-button" onClick={() => handleAddTask(null)}>+ Nueva tarea</button>
                </div>

                {loading ? (
                  <p style={{ color: "var(--text-muted)" }}>Cargando datos desde Firebase...</p>
                ) : rootTasks.length === 0 ? (
                  <p style={{ color: "var(--text-muted)" }}>No hay tareas guardadas aún.</p>
                ) : (
                  <div className="task-list">
                    {rootTasks.map((task) => {
                      const subtasks = getSubtasks(task.id);
                      const isDomAssigned = task.createdByRole === "Dominante";

                      return (
                        <div key={task.id} style={{ marginBottom: "12px" }}>
                          <div className={`task-card ${task.completed ? "completed" : ""}`}>
                            <button className="check-button" onClick={() => toggleTask(task.id, task.completed)}>
                              {task.completed ? "✓" : ""}
                            </button>
                            <div className="task-information">
                              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                <strong>{task.title}</strong>
                                {isDomAssigned && (
                                  <span style={{ fontSize: "10px", background: "var(--accent-bg)", color: "var(--accent-text)", border: "1px solid var(--accent-primary)", padding: "1px 5px", borderRadius: "4px" }}>
                                    Dominante
                                  </span>
                                )}
                              </div>
                              <span>{task.description}</span>
                              {task.evidenceUrl && (
                                <div>
                                  <a href={task.evidenceUrl} target="_blank" rel="noreferrer" style={{ fontSize: "11px", color: "var(--accent-text)", textDecoration: "underline" }}>
                                    Ver Evidencia Fotográfica ↗
                                  </a>
                                  <div>
                                    <img src={task.evidenceUrl} alt="Evidencia" className="evidence-preview" />
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className="task-points" style={{ marginRight: "8px" }}>+{task.points}</div>

                            <div style={{ display: "flex", gap: "4px" }}>
                              <button className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleAddTask(task.id)} title="Agregar Subtarea">
                                + Sub
                              </button>
                              <button className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleEditTask(task)} title="Editar Tarea">
                                ✎
                              </button>
                              <button className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px", color: "var(--text-muted)" }} onClick={() => handleDeleteTask(task)} title="Eliminar Tarea">
                                ✕
                              </button>
                            </div>
                          </div>

                          {subtasks.length > 0 && (
                            <div style={{ paddingLeft: "28px", marginTop: "6px", display: "flex", flexDirection: "column", gap: "6px" }}>
                              {subtasks.map((sub) => (
                                <div key={sub.id} className={`task-card ${sub.completed ? "completed" : ""}`} style={{ background: "var(--bg-main)", borderLeft: "2px solid var(--accent-primary)" }}>
                                  <button className="check-button" onClick={() => toggleTask(sub.id, sub.completed)}>
                                    {sub.completed ? "✓" : ""}
                                  </button>
                                  <div className="task-information">
                                    <strong>↳ {sub.title}</strong>
                                    <span>{sub.description}</span>
                                    {sub.evidenceUrl && (
                                      <div>
                                        <a href={sub.evidenceUrl} target="_blank" rel="noreferrer" style={{ fontSize: "11px", color: "var(--accent-text)", textDecoration: "underline" }}>
                                          Ver Evidencia Fotográfica ↗
                                        </a>
                                        <div>
                                          <img src={sub.evidenceUrl} alt="Evidencia" className="evidence-preview" />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="task-points" style={{ marginRight: "8px" }}>+{sub.points}</div>

                                  <div style={{ display: "flex", gap: "4px" }}>
                                    <button className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleEditTask(sub)} title="Editar Subtarea">
                                      ✎
                                    </button>
                                    <button className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px", color: "var(--text-muted)" }} onClick={() => handleDeleteTask(sub)} title="Eliminar Subtarea">
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">GAMIFICACIÓN</p>
                <h2>Insignias y Rango</h2>
              </div>
            </div>

            <p style={{ color: "var(--text-sub)", fontSize: "13px", marginTop: "4px" }}>
              Desbloquea rangos e insignias automáticas cumpliendo hábitos y acumulando puntos históricos:
            </p>

            <div className="badges-container">
              {badgesList.map((badge) => (
                <div key={badge.id} className={`badge-card ${badge.unlocked ? "unlocked" : "locked"}`}>
                  <span className="badge-icon">{badge.icon}</span>
                  <div>
                    <h4 className="badge-title">{badge.title}</h4>
                    <p className="badge-desc">{badge.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "24px" }}>
              <div className="mini-stat">
                <span>Rango Asignado</span>
                <strong style={{ color: currentRankInfo.color }}>{currentRankInfo.icon} {currentRankInfo.rank}</strong>
              </div>

              <div className="mini-stat">
                <span>Puntos Acumulados Totales</span>
                <strong>{totalEarnedHistorical} pts</strong>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;