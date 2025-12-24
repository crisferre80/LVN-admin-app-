import React, { useState, useEffect } from "react";
import { Play, Plus, Trash2, Eye, Save, X, Tag, Edit, Upload, Clock, Users, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";

interface Video {
  id: string;
  title: string;
  url: string;
  category: string;
  placement: "featured" | "inline" | "sidebar" | "hero";
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  size?: "large" | "medium" | "small";
  is_live?: boolean;
  custom_lower_third?: string;
  custom_header?: string;
  tags?: string[];
  custom_logo_url?: string;
  embed_code?: string;
  // Nuevas propiedades
  video_file_url?: string; // URL del archivo de video subido
  pre_live_video_url?: string; // Video copete antes del vivo
  pre_live_video_file?: string; // Archivo de copete subido
  lower_third_names?: string[]; // Nombres/títulos de personajes para lower third
  is_visible?: boolean; // Controlar visibilidad del video
  has_countdown?: boolean; // Si tiene conteo regresivo
  countdown_target_date?: string; // Fecha objetivo del conteo
  countdown_title?: string; // Título del conteo regresivo
  countdown_message?: string; // Mensaje del conteo regresivo
  auto_switch_to_live?: boolean; // Cambiar automáticamente al vivo después del conteo
  created_at: string;
  updated_at: string;
}

type VideoCategory = "Deportes" | "Nacionales" | "Regionales" | "Internacionales" | "Economía" | "Espectaculos" | "Agro" | "Clasificados" | "Noticias de la Gente";

const YOUTUBE_URL_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)?$/;
const VDO_NINJA_HOSTS = ["vdo.ninja", "obs.ninja"];

const getNormalizedUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return "";
  }
  return /^(?:https?:)?\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const isYouTubeUrl = (url: string): boolean => {
  const normalized = getNormalizedUrl(url);
  // Es URL de video (ID) o URL de canal/usuario que puede tener /live
  return YOUTUBE_URL_REGEX.test(normalized) || Boolean(extractYouTubeChannelIdFromUrl(normalized));
};

const extractYouTubeId = (url: string): string | null => {
  const normalized = getNormalizedUrl(url);
  const match = normalized.match(YOUTUBE_URL_REGEX);
  return match ? match[1] : null;
};

// Extrae identificador de canal/usuario/alias desde una URL de YouTube
const extractYouTubeChannelIdFromUrl = (url: string): string | null => {
  try {
    const normalized = getNormalizedUrl(url);
    if (!normalized) return null;
    const parsed = new URL(normalized);
    const path = parsed.pathname || "";

    // /channel/UCxxxxxxxx
    const mChannel = path.match(/^\/channel\/([A-Za-z0-9_-]+)/);
    if (mChannel) return mChannel[1];

    // /user/username  or /c/customname  or /@username (new handles)
    const mUser = path.match(/^\/(?:user|c)\/([A-Za-z0-9_-]+)/);
    if (mUser) return mUser[1];

    const mAt = path.match(/^\/@([A-Za-z0-9_-]+)/);
    if (mAt) return `@${mAt[1]}`;

    // También aceptar /channel/ID/live (se captura arriba) o paths que incluyen /live
    const mChannelLive = path.match(/^\/channel\/([A-Za-z0-9_-]+)\/live/);
    if (mChannelLive) return mChannelLive[1];

    return null;
  } catch {
    return null;
  }
};

const isVdoNinjaUrl = (url: string): boolean => {
  try {
    const normalized = getNormalizedUrl(url);
    if (!normalized) {
      return false;
    }
    const { hostname } = new URL(normalized);
    return VDO_NINJA_HOSTS.some((allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`));
  } catch {
    return false;
  }
};

const buildYouTubeEmbedUrl = (url: string): string => {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    // Si no hay videoId, revisar si es una URL de canal con /live
    const channelId = extractYouTubeChannelIdFromUrl(url);
    if (channelId) {
      // Usar el endpoint especial para transmisiones en vivo por canal
      // Nota: idealmente channelId debería ser el ID del canal (empieza con UC...).
      // Para paths tipo @usuario o /c/customname puede que no funcione en todos los casos,
      // pero es útil para URLs del tipo /channel/<ID>/live.
      return `https://www.youtube.com/embed/live_stream?channel=${channelId}`;
    }

    return getNormalizedUrl(url);
  }

  const normalized = getNormalizedUrl(url);
  const isShort = normalized.includes("/shorts/");
  const baseUrl = `https://www.youtube.com/embed/${videoId}`;

  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    iv_load_policy: "3",
    fs: "1",
    cc_load_policy: "0",
    enablejsapi: "1"
  });

  if (isShort) {
    params.set("autoplay", "0");
    params.set("loop", "0");
    params.set("playlist", videoId);
  }

  return `${baseUrl}?${params.toString()}`;
};

const buildVdoNinjaEmbedUrl = (url: string): string => {
  try {
    const normalized = getNormalizedUrl(url);
    if (!normalized) {
      return url;
    }

    const parsed = new URL(normalized);

    if (parsed.pathname.includes("/embed")) {
      return normalized;
    }

    const queryParams = new URLSearchParams(parsed.search);
    const hashParams = parsed.hash.startsWith("#") ? new URLSearchParams(parsed.hash.substring(1)) : new URLSearchParams();

    hashParams.forEach((value, key) => {
      queryParams.set(key, value);
    });

    if (queryParams.has("room")) {
      queryParams.set("view", "1");
      if (!queryParams.has("clean")) {
        queryParams.set("clean", "1");
      }
      if (!queryParams.has("scene")) {
        queryParams.set("scene", "0");
      }
      if (!queryParams.has("autostart")) {
        queryParams.set("autostart", "1");
      }
      if (!queryParams.has("r")) {
        queryParams.set("r", "1"); // reduce UI
      }
    }

    const host = parsed.hostname.endsWith("obs.ninja")
      ? parsed.hostname.replace("obs.ninja", "vdo.ninja")
      : parsed.hostname;

    const queryString = queryParams.toString();
    return queryString ? `https://${host}/embed/?${queryString}` : `https://${host}/embed/`;
  } catch {
    return url;
  }
};

const getVideoEmbedUrl = (url: string): string => {
  if (isYouTubeUrl(url)) {
    return buildYouTubeEmbedUrl(url);
  }

  if (isVdoNinjaUrl(url)) {
    return buildVdoNinjaEmbedUrl(url);
  }

  return getNormalizedUrl(url);
};

const getIframeAllowAttributes = (url: string): string => {
  if (isVdoNinjaUrl(url)) {
    return "autoplay; camera; microphone; fullscreen; picture-in-picture; display-capture; midi; geolocation; screen-wake-lock";
  }

  return "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
};

const getAspectRatioClasses = (aspectRatio: string): string => {
  switch (aspectRatio) {
    case "16:9":
      return "aspect-video"; // 16:9
    case "9:16":
      return "aspect-[9/16]"; // 9:16
    case "1:1":
      return "aspect-square"; // 1:1
    default:
      return "aspect-video"; // default to 16:9
  }
};

const getSizeClasses = (size: string): string => {
  switch (size) {
    case "large":
      return "w-full max-w-4xl"; // Grande
    case "medium":
      return "w-full max-w-2xl"; // Mediano (normal)
    case "small":
      return "w-full max-w-lg"; // Pequeño
    default:
      return "w-full max-w-2xl"; // default to medium
  }
};

export const VideoManager: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    url: "",
    category: "Deportes" as VideoCategory,
    placement: "featured" as "featured" | "inline" | "sidebar" | "hero",
    aspect_ratio: "16:9" as "16:9" | "9:16" | "1:1",
    size: "medium" as "large" | "medium" | "small",
    is_live: false,
    custom_lower_third: "",
    custom_header: "",
    tags: [] as string[],
    custom_logo_url: "",
    embed_code: "",
    // Nuevos campos
    video_file_url: "",
    pre_live_video_url: "",
    pre_live_video_file: "",
    lower_third_names: [] as string[],
    is_visible: true,
    has_countdown: false,
    countdown_target_date: "",
    countdown_title: "",
    countdown_message: "",
    auto_switch_to_live: false
  });

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error) {
      console.error("Error fetching videos:", error);
      console.error("Error details:", error instanceof Error ? error.message : "Unknown error");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = formData.title.trim();
    const trimmedUrl = formData.url.trim();

    if (!trimmedTitle || (!trimmedUrl && !formData.embed_code.trim())) {
      alert("Por favor completa el título y una URL o código de incrustación");
      return;
    }

    if (trimmedUrl && !isYouTubeUrl(trimmedUrl) && !isVdoNinjaUrl(trimmedUrl)) {
      alert("Por favor ingresa una URL válida de YouTube o VDO.Ninja/OBS.Ninja");
      return;
    }

    setSaving(true);
    try {
      const videoData = {
        title: trimmedTitle,
        url: getNormalizedUrl(trimmedUrl),
        category: formData.category,
        placement: formData.placement,
        aspect_ratio: formData.aspect_ratio,
        size: formData.size,
        is_live: formData.is_live,
        custom_lower_third: formData.custom_lower_third.trim() || null,
        custom_header: formData.custom_header.trim() || null,
        tags: formData.tags.length > 0 ? formData.tags : null,
        custom_logo_url: formData.custom_logo_url.trim() || null,
        embed_code: formData.embed_code.trim() || null,
        // Nuevos campos
        video_file_url: formData.video_file_url.trim() || null,
        pre_live_video_url: formData.pre_live_video_url.trim() || null,
        pre_live_video_file: formData.pre_live_video_file.trim() || null,
        lower_third_names: formData.lower_third_names.length > 0 ? formData.lower_third_names : null,
        is_visible: formData.is_visible,
        has_countdown: formData.has_countdown,
        countdown_target_date: formData.countdown_target_date.trim() || null,
        countdown_title: formData.countdown_title.trim() || null,
        countdown_message: formData.countdown_message.trim() || null,
        auto_switch_to_live: formData.auto_switch_to_live,
        updated_at: new Date().toISOString()
      };

      if (editingVideo) {
        // Modo edición - UPDATE
        const { error } = await supabase
          .from("videos")
          .update(videoData)
          .eq("id", editingVideo.id);

        if (error) throw error;
        alert("Video actualizado exitosamente");
      } else {
        // Modo creación - INSERT
        const { error } = await supabase
          .from("videos")
          .insert([{
            ...videoData,
            created_at: new Date().toISOString()
          }]);

        if (error) throw error;
        alert("Video agregado exitosamente");
      }

      // Reset form
      setFormData({
        title: "",
        url: "",
        category: "Deportes",
        placement: "featured",
        aspect_ratio: "16:9",
        size: "medium",
        is_live: false,
        custom_lower_third: "",
        custom_header: "",
        tags: [],
        custom_logo_url: "",
        embed_code: "",
        video_file_url: "",
        pre_live_video_url: "",
        pre_live_video_file: "",
        lower_third_names: [],
        is_visible: true,
        has_countdown: false,
        countdown_target_date: "",
        countdown_title: "",
        countdown_message: "",
        auto_switch_to_live: false
      });
      setShowForm(false);
      setEditingVideo(null);
      fetchVideos();
    } catch (error) {
      console.error("Error saving video:", error);
      console.error("Error details:", error instanceof Error ? error.message : "Unknown error");
      alert(`Error al ${editingVideo ? "actualizar" : "guardar"} el video: ${error instanceof Error ? error.message : "Error desconocido"}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteVideo = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este video?")) return;

    try {
      const { error } = await supabase
        .from("videos")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setVideos(prev => prev.filter(video => video.id !== id));
      alert("Video eliminado exitosamente");
    } catch (error) {
      console.error("Error deleting video:", error);
      console.error("Error details:", error instanceof Error ? error.message : "Unknown error");
      alert("Error al eliminar el video");
    }
  };

  const editVideo = (video: Video) => {
    setEditingVideo(video);
    setFormData({
      title: video.title,
      url: video.url,
      category: video.category as VideoCategory,
      placement: video.placement,
      aspect_ratio: video.aspect_ratio || "16:9",
      size: video.size || "medium",
      is_live: video.is_live || false,
      custom_lower_third: video.custom_lower_third || "",
      custom_header: video.custom_header || "",
      tags: video.tags || [],
      custom_logo_url: video.custom_logo_url || "",
      embed_code: video.embed_code || "",
      video_file_url: video.video_file_url || "",
      pre_live_video_url: video.pre_live_video_url || "",
      pre_live_video_file: video.pre_live_video_file || "",
      lower_third_names: video.lower_third_names || [],
      is_visible: video.is_visible !== undefined ? video.is_visible : true,
      has_countdown: video.has_countdown || false,
      countdown_target_date: video.countdown_target_date || "",
      countdown_title: video.countdown_title || "",
      countdown_message: video.countdown_message || "",
      auto_switch_to_live: video.auto_switch_to_live || false
    });
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingVideo(null);
    setFormData({
      title: "",
      url: "",
      category: "Deportes",
      placement: "featured",
      aspect_ratio: "16:9",
      size: "medium",
      is_live: false,
      custom_lower_third: "",
      custom_header: "",
      tags: [],
      custom_logo_url: "",
      embed_code: "",
      video_file_url: "",
      pre_live_video_url: "",
      pre_live_video_file: "",
      lower_third_names: [],
      is_visible: true,
      has_countdown: false,
      countdown_target_date: "",
      countdown_title: "",
      countdown_message: "",
      auto_switch_to_live: false
    });
    setShowForm(false);
  };

  // Función para alternar visibilidad de un video
  const toggleVideoVisibility = async (videoId: string, currentVisibility: boolean) => {
    try {
      const { error } = await supabase
        .from("videos")
        .update({ 
          is_visible: !currentVisibility,
          updated_at: new Date().toISOString()
        })
        .eq("id", videoId);

      if (error) throw error;

      // Actualizar en el estado local
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, is_visible: !currentVisibility }
          : video
      ));

      alert(`Video ${!currentVisibility ? 'mostrado' : 'ocultado'} exitosamente`);
    } catch (error) {
      console.error("Error toggling video visibility:", error);
      alert("Error al cambiar la visibilidad del video");
    }
  };

  // Función para subir archivos de video
  const handleVideoUpload = async (file: File, fieldName: 'video_file_url' | 'pre_live_video_file') => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `videos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, [fieldName]: publicUrl }));
      alert('Video subido exitosamente');
    } catch (error) {
      console.error('Error uploading video:', error);
      alert('Error al subir el video');
    }
  };

  const categories: VideoCategory[] = [
    "Deportes", "Nacionales", "Regionales", "Internacionales",
    "Economía", "Espectaculos", "Agro", "Clasificados", "Noticias de la Gente"
  ];

  if (loading) {
    return <div className="p-4 md:p-6">Cargando videos...</div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-xl md:text-2xl font-bold">Gestión de Videos</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={20} />
          Agregar Video
        </button>
      </div>

      {/* Formulario para agregar video */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              {editingVideo ? "Editar Video" : "Agregar Nuevo Video"}
            </h3>
            <button
              onClick={editingVideo ? cancelEdit : () => setShowForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título del Video
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ingresa el título del video"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL de la transmisión
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://www.youtube.com/watch?v=..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Acepta enlaces de YouTube (incluye Shorts/Live) o de VDO.Ninja / OBS.Ninja.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as VideoCategory }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ubicación
                </label>
                <select
                  value={formData.placement}
                  onChange={(e) => setFormData(prev => ({ ...prev, placement: e.target.value as "featured" | "inline" | "sidebar" | "hero" }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="featured">Destacado (al inicio de la categoría)</option>
                  <option value="inline">En línea (dentro del contenido)</option>
                  <option value="sidebar">Barra lateral</option>
                  <option value="hero">Hero (portada principal)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relación de Aspecto
                </label>
                <select
                  value={formData.aspect_ratio}
                  onChange={(e) => setFormData(prev => ({ ...prev, aspect_ratio: e.target.value as "16:9" | "9:16" | "1:1" }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="16:9">16:9 (Horizontal)</option>
                  <option value="9:16">9:16 (Vertical)</option>
                  <option value="1:1">1:1 (Cuadrado)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tamaño
                </label>
                <select
                  value={formData.size}
                  onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value as "large" | "medium" | "small" }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="large">Grande</option>
                  <option value="medium">Mediano (Normal)</option>
                  <option value="small">Pequeño</option>
                </select>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_live"
                checked={formData.is_live}
                onChange={(e) => setFormData(prev => ({ ...prev, is_live: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_live" className="ml-2 block text-sm text-gray-700">
                Este es un video en vivo (transmisión en directo)
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código de Incrustación (opcional)
              </label>
              <textarea
                value={formData.embed_code}
                onChange={(e) => setFormData(prev => ({ ...prev, embed_code: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="<iframe>...</iframe>"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Si tienes un código de embed personalizado, pégalo aquí. Tiene prioridad sobre la URL.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Texto Personalizado del Header
                </label>
                <input
                  type="text"
                  value={formData.custom_header}
                  onChange={(e) => setFormData(prev => ({ ...prev, custom_header: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Texto para el header del video"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Texto Personalizado del Lower Third
                </label>
                <input
                  type="text"
                  value={formData.custom_lower_third}
                  onChange={(e) => setFormData(prev => ({ ...prev, custom_lower_third: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Texto para el lower third"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL del Logo Personalizado (opcional)
              </label>
              <input
                type="url"
                value={formData.custom_logo_url}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_logo_url: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Etiquetas (separadas por comas)
              </label>
              <input
                type="text"
                value={formData.tags.join(", ")}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value.split(",").map(t => t.trim()).filter(t => t) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="noticias, deportes, local"
              />
            </div>

            {/* NUEVAS SECCIONES */}
            
            {/* Sección de Archivos de Video */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Upload size={16} />
                Archivos de Video
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Archivo de Video Principal
                  </label>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVideoUpload(file, 'video_file_url');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formData.video_file_url && (
                    <p className="text-xs text-green-600 mt-1">Archivo subido exitosamente</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Archivo de Copete Pre-Vivo
                  </label>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVideoUpload(file, 'pre_live_video_file');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formData.pre_live_video_file && (
                    <p className="text-xs text-green-600 mt-1">Copete subido exitosamente</p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL de Video Copete Pre-Vivo (alternativa)
                </label>
                <input
                  type="url"
                  value={formData.pre_live_video_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, pre_live_video_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://... (URL de video para reproducir antes del vivo)"
                />
              </div>
            </div>

            {/* Sección de Lower Third / Nombres */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Users size={16} />
                Nombres y Títulos para Lower Third
              </h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombres/Títulos de Personajes (separados por comas)
                </label>
                <input
                  type="text"
                  value={formData.lower_third_names.join(", ")}
                  onChange={(e) => setFormData(prev => ({ ...prev, lower_third_names: e.target.value.split(",").map(t => t.trim()).filter(t => t) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Juan Pérez - Periodista, María García - Corresponsal, Dr. López - Especialista"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Agregar nombres y títulos de personas que aparecerán en el video para mostrar en el lower third
                </p>
              </div>
            </div>

            {/* Sección de Conteo Regresivo */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Clock size={16} />
                Conteo Regresivo
              </h4>
              
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="has_countdown"
                  checked={formData.has_countdown}
                  onChange={(e) => setFormData(prev => ({ ...prev, has_countdown: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="has_countdown" className="ml-2 block text-sm text-gray-700">
                  Activar conteo regresivo antes de la transmisión
                </label>
              </div>

              {formData.has_countdown && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha y Hora Objetivo
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.countdown_target_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, countdown_target_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Título del Conteo
                    </label>
                    <input
                      type="text"
                      value={formData.countdown_title}
                      onChange={(e) => setFormData(prev => ({ ...prev, countdown_title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Próximamente: Transmisión Especial"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mensaje del Conteo
                    </label>
                    <textarea
                      value={formData.countdown_message}
                      onChange={(e) => setFormData(prev => ({ ...prev, countdown_message: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="No te pierdas nuestra transmisión especial..."
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="auto_switch_to_live"
                      checked={formData.auto_switch_to_live}
                      onChange={(e) => setFormData(prev => ({ ...prev, auto_switch_to_live: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="auto_switch_to_live" className="ml-2 block text-sm text-gray-700">
                      Cambiar automáticamente al vivo cuando termine el conteo
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Sección de Visibilidad */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                {formData.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}
                Control de Visibilidad
              </h4>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_visible"
                  checked={formData.is_visible}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_visible: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_visible" className="ml-2 block text-sm text-gray-700">
                  Video visible para los usuarios (desmarcar para ocultar temporalmente)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={editingVideo ? cancelEdit : () => setShowForm(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Save size={16} />
                {saving ? "Guardando..." : editingVideo ? "Actualizar Video" : "Guardar Video"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vista previa del video */}
      {previewVideo && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold">Vista Previa: {previewVideo.title}</h3>
            <button
              onClick={() => setPreviewVideo(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>

          {/* Video con lower third y header */}
          <div className="bg-white rounded-lg shadow-md p-2 md:p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-2 md:mb-4">Video Destacado</h3>
            <div className={`relative ${getSizeClasses(previewVideo.size || "medium")} mx-auto`}>
              <div className={`relative w-full ${getAspectRatioClasses(previewVideo.aspect_ratio || "16:9")}`}>
                {/* Header característico sobre el video */}
                <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-sky-800 to-sky-400 border-b-4 border-news-400 rounded-t-lg">
                  <div className="px-2 md:px-4 py-2 md:py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 md:gap-3">
                      <img
                        src={previewVideo.custom_logo_url || "/assets/logo.png"}
                        alt="Logo"
                        className="w-6 h-6 md:w-8 md:h-8 object-contain"
                      />
                      <div>
                        <h4 className="text-white font-bold text-xs md:text-sm leading-tight">
                          {previewVideo.custom_header || "La Voz del Norte"}
                        </h4>
                        <p className="text-white/90 text-xs hidden md:block">
                          {previewVideo.category}
                        </p>
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-white/90 text-xs">
                        {new Date().toLocaleDateString("es-AR", {
                          weekday: "long",
                          day: "numeric",
                          month: "short"
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <iframe
                  width="560"
                  height="315"
                  src={getVideoEmbedUrl(previewVideo.url)}
                  title={previewVideo.title}
                  frameBorder="0"
                  allow={getIframeAllowAttributes(previewVideo.url)}
                  className="w-full h-full rounded-lg"
                ></iframe>

                {/* Lower Third Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent rounded-b-lg">
                  <div className="p-2 md:p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 md:gap-3">
                      <img
                        src={previewVideo.custom_logo_url || "/assets/logo.png"}
                        alt="Logo"
                        className="w-6 h-6 md:w-8 md:h-8 object-contain"
                      />
                      <div>
                        <h4 className="text-white font-bold text-xs md:text-sm leading-tight">
                          {previewVideo.custom_lower_third || "La Voz del Norte"}
                        </h4>
                        <p className="text-white/80 text-xs hidden md:block">
                          Diario Digital Independiente
                        </p>
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-white/90 text-xs">
                        Santiago del Estero • Tucumán • Salta
                      </p>
                      <p className="text-white/70 text-xs">
                        www.lavozdelnortediario.com
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de videos */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Videos ({videos.length})</h3>
        </div>

        {videos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Play size={48} className="mx-auto mb-4 opacity-50" />
            <p>No hay videos agregados aún</p>
            <p className="text-sm">Haz clic en "Agregar Video" para comenzar</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {videos.map((video) => (
              <div key={video.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-lg">{video.title}</h4>
                      {video.is_live && (
                        <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 animate-pulse">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                          EN VIVO
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {video.category}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        video.placement === "featured"
                          ? "bg-green-100 text-green-800"
                          : video.placement === "inline"
                          ? "bg-yellow-100 text-yellow-800"
                          : video.placement === "sidebar"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-purple-100 text-purple-800"
                      }`}>
                        {video.placement === "featured" ? "Destacado" :
                         video.placement === "inline" ? "En línea" :
                         video.placement === "sidebar" ? "Barra lateral" : "Hero"}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        video.aspect_ratio === "16:9"
                          ? "bg-indigo-100 text-indigo-800"
                          : video.aspect_ratio === "9:16"
                          ? "bg-pink-100 text-pink-800"
                          : "bg-orange-100 text-orange-800"
                      }`}>
                        {video.aspect_ratio || "16:9"}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        video.size === "large"
                          ? "bg-red-100 text-red-800"
                          : video.size === "medium"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {video.size === "large" ? "Grande" : video.size === "small" ? "Pequeño" : "Mediano"}
                      </span>
                      {video.tags && video.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Tag size={12} />
                          <span className="text-xs text-gray-500">{video.tags.join(", ")}</span>
                        </div>
                      )}
                      
                      {/* Nuevos indicadores */}
                      {!video.is_visible && (
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs flex items-center gap-1">
                          <EyeOff size={12} />
                          Oculto
                        </span>
                      )}
                      
                      {video.has_countdown && (
                        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs flex items-center gap-1">
                          <Clock size={12} />
                          Conteo
                        </span>
                      )}
                      
                      {video.video_file_url && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs flex items-center gap-1">
                          <Upload size={12} />
                          Archivo
                        </span>
                      )}
                      
                      {video.pre_live_video_url && (
                        <span className="bg-cyan-100 text-cyan-800 px-2 py-1 rounded text-xs">
                          Copete
                        </span>
                      )}
                      
                      {video.lower_third_names && video.lower_third_names.length > 0 && (
                        <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-xs flex items-center gap-1">
                          <Users size={12} />
                          {video.lower_third_names.length} nombres
                        </span>
                      )}
                      
                      <span>
                        {new Date(video.created_at).toLocaleDateString("es-AR")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 truncate max-w-md">
                      {video.url}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setPreviewVideo(video)}
                      className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 flex items-center gap-1"
                      title="Vista previa"
                    >
                      <Eye size={16} />
                      Vista Previa
                    </button>
                    <button
                      onClick={() => toggleVideoVisibility(video.id, video.is_visible ?? true)}
                      className={`px-3 py-2 rounded flex items-center gap-1 ${
                        video.is_visible 
                          ? 'bg-gray-600 text-white hover:bg-gray-700' 
                          : 'bg-yellow-600 text-white hover:bg-yellow-700'
                      }`}
                      title={video.is_visible ? "Ocultar video" : "Mostrar video"}
                    >
                      {video.is_visible ? <EyeOff size={16} /> : <Eye size={16} />}
                      {video.is_visible ? 'Ocultar' : 'Mostrar'}
                    </button>
                    <button
                      onClick={() => editVideo(video)}
                      className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 flex items-center gap-1"
                      title="Editar"
                    >
                      <Edit size={16} />
                      Editar
                    </button>
                    <button
                      onClick={() => deleteVideo(video.id)}
                      className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 flex items-center gap-1"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
