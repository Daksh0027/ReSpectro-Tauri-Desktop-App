import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SignedIn, SignedOut, SignIn, SignUp, useUser, useAuth } from "@clerk/clerk-react";
import "./App.css";
import bgPattern from "./assets/BG.png";
import heroImage from "./assets/hero.png";
import logoImage from "./assets/logo.png";
import noPosterImage from "./assets/No-Poster.png";
import starIcon from "./assets/star.svg";

type MediaType = "movie" | "tv";
type MediaFilter = "all" | MediaType;

type MediaItem = {
  id: number;
  media_type: MediaType;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  poster_path?: string | null;
  original_language?: string;
  popularity?: number;
  genre_ids?: number[];
};

type TmdbListResponse = {
  results?: Omit<MediaItem, "media_type">[];
  total_pages?: number;
  status_message?: string;
};

type MediaDetails = MediaItem & {
  budget?: number;
  revenue?: number;
  episode_run_time?: number[];
  runtime?: number;
  genres?: { id: number; name: string }[];
  homepage?: string;
  overview?: string;
  status?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  external_ids?: {
    imdb_id?: string | null;
  };
};

const API_BASE_URL = "https://api.themoviedb.org/3";
const API_KEY = import.meta.env.VITE_TMDB_API_KEY as string | undefined;

function getMediaTitle(media: MediaItem) {
  return media.title || media.name || "Untitled";
}

function getMediaYear(media: MediaItem) {
  const date = media.release_date || media.first_air_date;
  return date ? date.split("-")[0] : "N/A";
}

function formatCurrency(value?: number) {
  if (!value) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRuntime(minutes?: number) {
  if (!minutes) {
    return "N/A";
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function MovieCard({ media, onClick, isWatched }: { media: MediaItem; onClick: () => void; isWatched: boolean }) {
  const posterUrl = media.poster_path
    ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
    : noPosterImage;

  return (
    <article className={`movie-card ${isWatched ? "watched" : ""}`} onClick={onClick}>
      <img className="movie-poster" src={posterUrl} alt={getMediaTitle(media)} />

      <div className="movie-info">
        <h3>{getMediaTitle(media)}</h3>

        <div className="movie-meta">
          <span className="rating">
            <img src={starIcon} alt="" />
            {media.vote_average ? media.vote_average.toFixed(1) : "N/A"}
          </span>
          <span className="dot">.</span>
          <span>{media.original_language || "N/A"}</span>
          <span className="dot">.</span>
          <span>{getMediaYear(media)}</span>
        </div>
      </div>
    </article>
  );
}

function ExpandedCard({
  mediaId,
  mediaType,
  onClose,
  onUpdateHistory,
  onUpdateFavorites,
  favoritesList,
}: {
  mediaId: number;
  mediaType: MediaType;
  onClose: () => void;
  onUpdateHistory: (history: MediaItem[]) => void;
  onUpdateFavorites: (favorites: MediaItem[]) => void;
  favoritesList: MediaItem[];
}) {
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedServer, setSelectedServer] = useState<string>("playimdb");

  const isFavorited = favoritesList.some((m) => m.id === mediaId && m.media_type === mediaType);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const fetchDetails = async () => {
      if (!API_KEY) {
        setErrorMessage("Missing VITE_TMDB_API_KEY.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/${mediaType}/${mediaId}?append_to_response=credits,external_ids`,
          {
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${API_KEY}`,
            },
          },
        );
        const data = (await response.json()) as MediaDetails & { status_message?: string };

        if (!response.ok) {
          throw new Error(data.status_message || "Error fetching details.");
        }

        setDetails({ ...data, media_type: mediaType });

        // Save watched media to Tauri history storage
        try {
          const updatedHistory = await invoke<MediaItem[]>("add_to_history", {
            item: {
              id: data.id,
              media_type: mediaType,
              title: data.title || null,
              name: data.name || null,
              release_date: data.release_date || null,
              first_air_date: data.first_air_date || null,
              vote_average: data.vote_average || null,
              poster_path: data.poster_path || null,
              original_language: data.original_language || null,
              popularity: data.popularity || null,
            },
          });
          onUpdateHistory(updatedHistory);
        } catch (err) {
          console.error("Failed to update watch history:", err);
        }

      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Error fetching details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [mediaId, mediaType]);

  const handleFavoriteToggle = async () => {
    if (!details) return;
    try {
      const updatedFavorites = await invoke<MediaItem[]>("toggle_favorite", {
        item: {
          id: details.id,
          media_type: mediaType,
          title: details.title || null,
          name: details.name || null,
          release_date: details.release_date || null,
          first_air_date: details.first_air_date || null,
          vote_average: details.vote_average || null,
          poster_path: details.poster_path || null,
          original_language: details.original_language || null,
          popularity: details.popularity || null,
        },
      });
      onUpdateFavorites(updatedFavorites);
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  const handlePanelClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const title = details ? getMediaTitle(details) : "";
  const releaseDate = details?.release_date || details?.first_air_date || "N/A";
  const runtime = mediaType === "movie" ? details?.runtime : details?.episode_run_time?.[0];
  const posterUrl = details?.poster_path
    ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
    : noPosterImage;
  const imdbId = details?.external_ids?.imdb_id;
  const tmdbId = mediaId;

  const getPlayerUrl = () => {
    switch (selectedServer) {
      case "playimdb":
        return imdbId ? `https://m.playimdb.com/title/${imdbId}/` : "";
      case "vidsrc_to":
        return `https://vidsrc.to/embed/${mediaType}/${imdbId || tmdbId}`;
      case "vidsrc_me":
        return imdbId 
          ? `https://vidsrc.me/embed/${mediaType}?imdb=${imdbId}` 
          : `https://vidsrc.me/embed/${mediaType}?tmdb=${tmdbId}`;
      case "2embed":
        return mediaType === "movie" 
          ? `https://www.2embed.cc/embed/${tmdbId}` 
          : `https://www.2embed.cc/embedtv/${tmdbId}`;
      case "vidlink":
        return mediaType === "movie"
          ? `https://vidlink.pro/movie/${tmdbId}`
          : `https://vidlink.pro/tv/${tmdbId}/1/1`;
      case "ezvidapi":
        return mediaType === "movie"
          ? `https://ezvidapi.com/embed/movie/${tmdbId}`
          : `https://ezvidapi.com/embed/tv/${tmdbId}/1/1`;
      default:
        return imdbId ? `https://m.playimdb.com/title/${imdbId}/` : "";
    }
  };

  const playerUrl = getPlayerUrl();

  return (
    <div className="expanded-backdrop" onClick={onClose}>
      <div className="expanded-card" onClick={handlePanelClick}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Close">
          x
        </button>

        {isLoading ? (
          <div className="spinner" role="status" aria-label="Loading details" />
        ) : errorMessage ? (
          <p className="error-message">{errorMessage}</p>
        ) : details ? (
          <>
            <header className="expanded-header">
              <h1>{title}</h1>
              <div className="expanded-meta-container">
                <div className="expanded-meta">
                  <span className="rating">
                    <img src={starIcon} alt="" />
                    {details.vote_average ? details.vote_average.toFixed(1) : "N/A"}
                  </span>
                  <span className="dot">.</span>
                  <span>{getMediaYear(details)}</span>
                  <span className="dot">.</span>
                  <span>{formatRuntime(runtime)}</span>
                </div>
                <button
                  className={`favorite-btn ${isFavorited ? "favorited" : ""}`}
                  type="button"
                  onClick={handleFavoriteToggle}
                  aria-label="Toggle Favorite"
                >
                  {isFavorited ? "❤️ Favorited" : "🤍 Add to Favorites"}
                </button>
              </div>
            </header>

            <section className="expanded-media">
              <img src={posterUrl} alt={`Poster for ${title}`} />
              <div className="player-container">
                <div className="player-header">
                  <span className="player-label">Server:</span>
                  <select
                    className="server-select"
                    value={selectedServer}
                    onChange={(e) => setSelectedServer(e.target.value)}
                  >
                    <option value="playimdb">PlayIMDb (Primary)</option>
                    <option value="vidsrc_to">VidSrc.to</option>
                    <option value="vidsrc_me">VidSrc.me</option>
                    <option value="2embed">2Embed</option>
                    <option value="vidlink">VidLink.pro</option>
                    <option value="ezvidapi">EZVidAPI</option>
                  </select>
                </div>
                <div className="player-frame">
                  {playerUrl ? (
                    <iframe
                      src={playerUrl}
                      title={`Player for ${title}`}
                      allowFullScreen
                    />
                  ) : (
                    <span>Player Not Available for this Server (Missing IMDb ID)</span>
                  )}
                </div>
              </div>
            </section>

            <section className="expanded-details">
              <div className="genre-list">
                {(details.genres || []).map((genre) => (
                  <span key={genre.id}>{genre.name}</span>
                ))}
              </div>

              <h2>Overview</h2>
              <p>{details.overview || "No overview available."}</p>

              <div className="facts-grid">
                <div>
                  <strong>Status</strong>
                  <span>{details.status || "N/A"}</span>
                </div>
                <div>
                  <strong>Release Date</strong>
                  <span>{releaseDate}</span>
                </div>
                {mediaType === "movie" ? (
                  <>
                    <div>
                      <strong>Budget</strong>
                      <span>{formatCurrency(details.budget)}</span>
                    </div>
                    <div>
                      <strong>Revenue</strong>
                      <span>{formatCurrency(details.revenue)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <strong>Seasons</strong>
                      <span>{details.number_of_seasons || "N/A"}</span>
                    </div>
                    <div>
                      <strong>Episodes</strong>
                      <span>{details.number_of_episodes || "N/A"}</span>
                    </div>
                  </>
                )}
              </div>

              {details.homepage && (
                <a className="homepage-link" href={details.homepage} target="_blank" rel="noreferrer">
                  Visit Homepage
                </a>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

const GENRES_LIST = [
  { name: "Action", ids: [28, 10759] },
  { name: "Adventure", ids: [12, 10759] },
  { name: "Animation", ids: [16] },
  { name: "Comedy", ids: [35] },
  { name: "Drama", ids: [18] },
  { name: "Horror", ids: [27] },
  { name: "Mystery", ids: [9648] },
  { name: "Romance", ids: [10749] },
  { name: "Sci-Fi & Fantasy", ids: [878, 10765] },
  { name: "Thriller", ids: [53] },
];

function App() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState<null | "signin" | "signup">(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<{ id: number; type: MediaType } | null>(null);
  const [viewMode, setViewMode] = useState<"discover" | "favorites" | "history">("discover");
  const [favorites, setFavorites] = useState<MediaItem[]>([]);
  const [historyList, setHistoryList] = useState<MediaItem[]>([]);
  const [activeGenre, setActiveGenre] = useState<{ name: string; ids: number[] } | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);

  const visibleMediaList = useMemo(() => {
    return mediaList
      .filter((media) => mediaFilter === "all" || media.media_type === mediaFilter)
      .filter((media) => !activeGenre || media.genre_ids?.some((id) => activeGenre.ids.includes(id)));
  }, [mediaFilter, mediaList, activeGenre]);

  const visibleFavorites = useMemo(() => {
    return favorites.filter((media) => !activeGenre || media.genre_ids?.some((id) => activeGenre.ids.includes(id)));
  }, [favorites, activeGenre]);

  const visibleHistory = useMemo(() => {
    return historyList.filter((media) => !activeGenre || media.genre_ids?.some((id) => activeGenre.ids.includes(id)));
  }, [historyList, activeGenre]);

  const fetchMedia = async (query = "", pageNum = 1) => {
    if (!API_KEY) {
      setErrorMessage("Missing VITE_TMDB_API_KEY. Add it to Raven/.env to fetch movies.");
      return;
    }

    if (pageNum === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    setErrorMessage("");

    try {
      const movieEndpoint = query
        ? `${API_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&page=${pageNum}`
        : `${API_BASE_URL}/discover/movie?sort_by=popularity.desc&page=${pageNum}`;

      const seriesEndpoint = query
        ? `${API_BASE_URL}/search/tv?query=${encodeURIComponent(query)}&page=${pageNum}`
        : `${API_BASE_URL}/tv/top_rated?language=en-US&page=${pageNum}`;

      const requestOptions = {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
      };

      const [movieResponse, seriesResponse] = await Promise.all([
        fetch(movieEndpoint, requestOptions),
        fetch(seriesEndpoint, requestOptions),
      ]);

      const [movieData, seriesData] = (await Promise.all([
        movieResponse.json(),
        seriesResponse.json(),
      ])) as [TmdbListResponse, TmdbListResponse];

      if (!movieResponse.ok || !seriesResponse.ok) {
        throw new Error(movieData.status_message || seriesData.status_message || "Error fetching data.");
      }

      const movies: MediaItem[] = (movieData.results || []).map((item) => ({
        ...item,
        media_type: "movie",
      }));

      const series: MediaItem[] = (seriesData.results || []).map((item) => ({
        ...item,
        media_type: "tv",
      }));

      const combinedResults = [...movies, ...series].sort(
        (a, b) => (b.popularity || 0) - (a.popularity || 0),
      );

      const maxPages = Math.max(movieData.total_pages || 0, seriesData.total_pages || 0);
      setHasMore(pageNum < maxPages && pageNum < 500);

      if (combinedResults.length === 0 && pageNum === 1) {
        setErrorMessage("No movies or series found for your search.");
      }

      setMediaList((previous) => (pageNum === 1 ? combinedResults : [...previous, ...combinedResults]));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error fetching data.";
      setErrorMessage(message);

      if (pageNum === 1) {
        setMediaList([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = searchTerm.trim();
    if (nextQuery !== activeQuery) {
      setActiveQuery(nextQuery);
      setPage(1);
      fetchMedia(nextQuery, 1);
    }
  };

  // Debounced search: triggers search 500ms after user stops typing
  useEffect(() => {
    const nextQuery = searchTerm.trim();
    if (nextQuery === activeQuery) return;

    const timer = setTimeout(() => {
      setActiveQuery(nextQuery);
      setPage(1);
      fetchMedia(nextQuery, 1);
      
      if (nextQuery !== "") {
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, activeQuery]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchMedia(activeQuery, nextPage);
  };

  const handleReset = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setSearchTerm("");
    setActiveQuery("");
    setPage(1);
    setMediaFilter("all");
    setActiveGenre(null);
    setViewMode("discover");
    fetchMedia("", 1);

    const mainContentEl = document.querySelector(".main-content");
    if (mainContentEl) {
      mainContentEl.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    fetchMedia("", 1);
  }, []);

  useEffect(() => {
    if (user) {
      const syncWithLocal = async () => {
        const cloudFavs = (user.unsafeMetadata.favorites as MediaItem[]) || [];
        const cloudHist = (user.unsafeMetadata.history as MediaItem[]) || [];

        try {
          const localFavs = await invoke<MediaItem[]>("get_favorites");
          const localHist = await invoke<MediaItem[]>("get_history");

          const mergedFavs = [...cloudFavs];
          localFavs.forEach((local) => {
            if (!mergedFavs.some((m) => m.id === local.id && m.media_type === local.media_type)) {
              mergedFavs.push(local);
            }
          });

          const mergedHist = [...cloudHist];
          localHist.forEach((local) => {
            if (!mergedHist.some((m) => m.id === local.id && m.media_type === local.media_type)) {
              mergedHist.push(local);
            }
          });
          if (mergedHist.length > 50) {
            mergedHist.slice(0, 50);
          }

          setFavorites(mergedFavs);
          setHistoryList(mergedHist);

          if (localFavs.length > 0 || localHist.length > 0) {
            await user.update({
              unsafeMetadata: {
                ...user.unsafeMetadata,
                favorites: mergedFavs,
                history: mergedHist,
              },
            });
          }
        } catch (err) {
          console.error("Error merging local data with Clerk:", err);
          setFavorites(cloudFavs);
          setHistoryList(cloudHist);
        }
      };

      syncWithLocal();
    } else {
      const loadLocalData = async () => {
        try {
          const favs = await invoke<MediaItem[]>("get_favorites");
          setFavorites(favs);
          const hist = await invoke<MediaItem[]>("get_history");
          setHistoryList(hist);
        } catch (err) {
          console.error("Failed to load local favorites/history:", err);
        }
      };
      loadLocalData();
    }
  }, [user]);

  const handleUpdateFavorites = async (updatedFavorites: MediaItem[]) => {
    setFavorites(updatedFavorites);
    if (user) {
      try {
        await user.update({
          unsafeMetadata: {
            ...user.unsafeMetadata,
            favorites: updatedFavorites,
          },
        });
      } catch (err) {
        console.error("Failed to sync favorites to Clerk:", err);
      }
    }
  };

  const handleUpdateHistory = async (updatedHistory: MediaItem[]) => {
    setHistoryList(updatedHistory);
    if (user) {
      try {
        await user.update({
          unsafeMetadata: {
            ...user.unsafeMetadata,
            history: updatedHistory,
          },
        });
      } catch (err) {
        console.error("Failed to sync history to Clerk:", err);
      }
    }
  };

  return (
    <main className="App">
      <img className="background-pattern" src={bgPattern} alt="" />

      <header className="topbar">
        <div className="topbar-left">
          <a className="brand" href="#" onClick={handleReset}>
            <img src={logoImage} alt="" />
            <span>ReSpectro</span>
          </a>
        </div>

        <div className="topbar-center">
          <form className="top-search-bar" onSubmit={handleSearch}>
            <span className="search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search movies and series..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <button type="submit" style={{ display: "none" }}>Search</button>
          </form>
        </div>

        <div className="topbar-right">
          <SignedOut>
            <button
              className="sign-in-btn"
              type="button"
              onClick={() => setShowAuthModal("signin")}
            >
              Sign In
            </button>
          </SignedOut>

          <SignedIn>
            <div className="user-profile">
              <span className="user-name">👋 {user?.firstName || user?.username || "User"}</span>
              <button
                className="sign-out-btn"
                type="button"
                onClick={() => signOut()}
              >
                Sign Out
              </button>
            </div>
          </SignedIn>
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <nav className="sidebar-nav" aria-label="Primary navigation">
            <button
              className={viewMode === "discover" && mediaFilter === "movie" ? "sidebar-link active" : "sidebar-link"}
              type="button"
              onClick={() => {
                setViewMode("discover");
                setMediaFilter("movie");
              }}
            >
              <span className="nav-icon">🎬</span> Movies
            </button>
            <button
              className={viewMode === "discover" && mediaFilter === "tv" ? "sidebar-link active" : "sidebar-link"}
              type="button"
              onClick={() => {
                setViewMode("discover");
                setMediaFilter("tv");
              }}
            >
              <span className="nav-icon">📺</span> Series
            </button>
            <button
              className={viewMode === "favorites" ? "sidebar-link active" : "sidebar-link"}
              type="button"
              onClick={() => setViewMode("favorites")}
            >
              <span className="nav-icon">❤️</span> Favorites
            </button>
            <button
              className={viewMode === "history" ? "sidebar-link active" : "sidebar-link"}
              type="button"
              onClick={() => setViewMode("history")}
            >
              <span className="nav-icon">📜</span> History
            </button>
          </nav>
        </aside>

        <div className="main-content">
          <section className="hero">
            <img className="hero-art" src={heroImage} alt="Featured movies" />
            <h1>
              Find <span>Movies And Series</span> You'll Enjoy Without the Hassle
            </h1>
          </section>

          <section className="all-movies" ref={resultsRef}>
            <div className="section-heading">
              <h2>
                {viewMode === "favorites"
                  ? "My Favorites"
                  : viewMode === "history"
                    ? "Watch History"
                    : mediaFilter === "movie"
                      ? "Popular Movies"
                      : mediaFilter === "tv"
                        ? "Top Rated Series"
                        : "Popular Movies And Series"}
              </h2>
              {viewMode === "discover" && mediaFilter !== "all" && (
                <button type="button" onClick={() => setMediaFilter("all")}>
                  Show All
                </button>
              )}
            </div>

            {/* Genre Filter Bar */}
            <div className="genre-filter-container">
              <div className="genre-filter-bar" aria-label="Filter by genre">
                <button
                  className={activeGenre === null ? "active" : ""}
                  type="button"
                  onClick={() => setActiveGenre(null)}
                >
                  All Genres
                </button>
                {GENRES_LIST.map((genre) => (
                  <button
                    key={genre.name}
                    className={activeGenre?.name === genre.name ? "active" : ""}
                    type="button"
                    onClick={() => setActiveGenre(genre)}
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
            </div>

            {viewMode === "favorites" ? (
              favorites.length === 0 ? (
                <p className="empty-message">No favorites added yet.</p>
              ) : visibleFavorites.length === 0 ? (
                <p className="empty-message">No favorites found for this genre.</p>
              ) : (
                <div className="movie-grid">
                  {visibleFavorites.map((media) => {
                    const isWatched = historyList.some((h) => h.id === media.id && h.media_type === media.media_type);
                    return (
                      <MovieCard
                        key={`fav-${media.media_type}-${media.id}`}
                        media={media}
                        onClick={() => setSelectedMedia({ id: media.id, type: media.media_type as MediaType })}
                        isWatched={isWatched}
                      />
                    );
                  })}
                </div>
              )
            ) : viewMode === "history" ? (
              historyList.length === 0 ? (
                <p className="empty-message">No watch history yet.</p>
              ) : visibleHistory.length === 0 ? (
                <p className="empty-message">No watch history found for this genre.</p>
              ) : (
                <div className="movie-grid">
                  {visibleHistory.map((media) => (
                    <MovieCard
                      key={`hist-${media.media_type}-${media.id}`}
                      media={media}
                      onClick={() => setSelectedMedia({ id: media.id, type: media.media_type as MediaType })}
                      isWatched={true}
                    />
                  ))}
                </div>
              )
            ) : isLoading ? (
              <div className="spinner" role="status" aria-label="Loading" />
            ) : errorMessage ? (
              <p className="error-message">{errorMessage}</p>
            ) : (
              <>
                {visibleMediaList.length === 0 ? (
                  <p className="empty-message">No items found matching the selected genre.</p>
                ) : (
                  <div className="movie-grid">
                    {visibleMediaList.map((media) => {
                      const isWatched = historyList.some((h) => h.id === media.id && h.media_type === media.media_type);
                      return (
                        <MovieCard
                          key={`${media.media_type}-${media.id}`}
                          media={media}
                          onClick={() => setSelectedMedia({ id: media.id, type: media.media_type })}
                          isWatched={isWatched}
                        />
                      );
                    })}
                  </div>
                )}

                {hasMore && (
                  <button className="load-more" type="button" onClick={handleLoadMore} disabled={isLoadingMore}>
                    {isLoadingMore ? "Loading..." : "Load More"}
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {selectedMedia && (
        <ExpandedCard
          mediaId={selectedMedia.id}
          mediaType={selectedMedia.type}
          onClose={() => setSelectedMedia(null)}
          onUpdateHistory={handleUpdateHistory}
          onUpdateFavorites={handleUpdateFavorites}
          favoritesList={favorites}
        />
      )}

      {showAuthModal && (
        <div className="auth-backdrop" onClick={() => setShowAuthModal(null)}>
          <div className="auth-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" type="button" onClick={() => setShowAuthModal(null)} aria-label="Close auth">
              x
            </button>
            {showAuthModal === "signin" ? (
              <SignIn routing="virtual" signUpUrl="#" afterSignInUrl="#" />
            ) : (
              <SignUp routing="virtual" signInUrl="#" afterSignUpUrl="#" />
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
