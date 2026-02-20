import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Cpu, Music, Gamepad2, Film, Search, Plus, ArrowUp, ArrowDown, LogOut, MessageSquare, Compass } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const ICON_MAP: Record<string, any> = { Cpu, Music, Gamepad2, Film };

type Club = { id: string; name: string; slug: string; description: string | null; icon: string | null };
type Post = { id: string; club_id: string; user_id: string; title: string; content: string | null; score: number; created_at: string; profiles?: { username: string; avatar_url: string | null } };
type Vote = { post_id: string; vote_value: number };
type Member = { user_id: string; profiles?: { username: string; avatar_url: string | null } };

const MainApp = () => {
  const { user, profile, signOut } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [myClubIds, setMyClubIds] = useState<string[]>([]);
  const [activeClub, setActiveClub] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("new");
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [posting, setPosting] = useState(false);

  // Fetch clubs and memberships
  useEffect(() => {
    const load = async () => {
      const [clubsRes, membershipsRes] = await Promise.all([
        supabase.from("clubs").select("*"),
        supabase.from("club_memberships").select("club_id").eq("user_id", user!.id),
      ]);
      const clubsData = (clubsRes.data || []) as Club[];
      setClubs(clubsData);
      const ids = (membershipsRes.data || []).map((m: any) => m.club_id);
      setMyClubIds(ids);
      if (ids.length > 0) setActiveClub(ids[0]);
    };
    if (user) load();
  }, [user]);

  // Fetch posts and votes for active club
  useEffect(() => {
    if (!activeClub || !user) return;
    const loadPosts = async () => {
      const { data } = await supabase
        .from("posts")
        .select("*, profiles(username, avatar_url)")
        .eq("club_id", activeClub)
        .order("created_at", { ascending: false });
      setPosts((data as unknown as Post[]) || []);
    };
    const loadVotes = async () => {
      const { data } = await supabase
        .from("post_votes")
        .select("post_id, vote_value")
        .eq("user_id", user.id);
      setVotes((data || []) as Vote[]);
    };
    const loadMembers = async () => {
      const { data } = await supabase
        .from("club_memberships")
        .select("user_id, profiles(username, avatar_url)")
        .eq("club_id", activeClub);
      setMembers((data as unknown as Member[]) || []);
    };
    loadPosts();
    loadVotes();
    loadMembers();
  }, [activeClub, user]);

  const handleVote = async (postId: string, value: number) => {
    const existing = votes.find((v) => v.post_id === postId);
    if (existing) {
      // Remove existing vote
      await supabase.from("post_votes").delete().eq("user_id", user!.id).eq("post_id", postId);
      setVotes((prev) => prev.filter((v) => v.post_id !== postId));
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, score: p.score - existing.vote_value } : p));
      if (existing.vote_value !== value) {
        // Re-vote with new value
        await supabase.from("post_votes").insert({ user_id: user!.id, post_id: postId, vote_value: value });
        setVotes((prev) => [...prev, { post_id: postId, vote_value: value }]);
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, score: p.score + value } : p));
      }
    } else {
      await supabase.from("post_votes").insert({ user_id: user!.id, post_id: postId, vote_value: value });
      setVotes((prev) => [...prev, { post_id: postId, vote_value: value }]);
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, score: p.score + value } : p));
    }
  };

  const handleCreatePost = async () => {
    if (!newTitle.trim() || !activeClub) return;
    setPosting(true);
    const { error } = await supabase.from("posts").insert({
      club_id: activeClub,
      user_id: user!.id,
      title: newTitle.trim(),
      content: newContent.trim() || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Post created!");
      setNewTitle("");
      setNewContent("");
      setShowNewPost(false);
      // Refresh posts
      const { data } = await supabase
        .from("posts")
        .select("*, profiles(username, avatar_url)")
        .eq("club_id", activeClub)
        .order("created_at", { ascending: false });
      setPosts((data as unknown as Post[]) || []);
    }
    setPosting(false);
  };

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.title.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q));
    }
    if (sort === "new") {
      result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      const now = Date.now();
      const windows: Record<string, number> = {
        "top-3m": 90 * 24 * 60 * 60 * 1000,
        "top-6m": 180 * 24 * 60 * 60 * 1000,
        "top-1y": 365 * 24 * 60 * 60 * 1000,
        "top-all": Infinity,
      };
      const window = windows[sort] || Infinity;
      result = [...result]
        .filter((p) => window === Infinity || now - new Date(p.created_at).getTime() < window)
        .sort((a, b) => b.score - a.score);
    }
    return result;
  }, [posts, search, sort]);

  const activeClubData = clubs.find((c) => c.id === activeClub);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-lg">
        <span className="text-foreground text-lg font-bold tracking-cinematic uppercase font-display">
          TUNE-IN
        </span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold">
                {profile?.username?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-foreground text-sm font-medium hidden sm:block">{profile?.username}</span>
          </div>
          <button onClick={signOut} className="text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <div className="flex flex-1 pt-16">
        {/* Left Sidebar */}
        <aside className="hidden md:flex w-60 flex-col border-r border-border p-4 gap-2 fixed top-16 bottom-0 overflow-y-auto bg-background/50 backdrop-blur-md">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 px-2">Your Clubs</p>
          {clubs
            .filter((c) => myClubIds.includes(c.id))
            .map((club) => {
              const Icon = ICON_MAP[club.icon || ""] || Compass;
              const active = activeClub === club.id;
              return (
                <motion.button
                  key={club.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveClub(club.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-primary/15 text-foreground border border-primary/30 glow-purple-subtle"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {club.name}
                </motion.button>
              );
            })}
          <div className="mt-auto pt-4">
            <button className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Compass className="w-4 h-4" /> Discover Clubs
            </button>
          </div>
        </aside>

        {/* Center Feed */}
        <main className="flex-1 md:ml-60 md:mr-64 p-4 md:p-6 max-w-3xl mx-auto w-full">
          {activeClubData && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">{activeClubData.name}</h1>
              <p className="text-sm text-muted-foreground">{activeClubData.description}</p>
            </motion.div>
          )}

          {/* Search + Sort + New Post */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search posts..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="new">New</option>
              <option value="top-3m">Top (3 months)</option>
              <option value="top-6m">Top (6 months)</option>
              <option value="top-1y">Top (1 year)</option>
              <option value="top-all">Top (All time)</option>
            </select>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowNewPost(!showNewPost)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium glow-purple-subtle"
            >
              <Plus className="w-4 h-4" /> Post
            </motion.button>
          </div>

          {/* New Post Form */}
          <AnimatePresence>
            {showNewPost && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-6"
              >
                <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-4 space-y-3">
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Post title"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Write something..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleCreatePost}
                      disabled={!newTitle.trim() || posting}
                      className="px-6 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all disabled:opacity-40"
                    >
                      {posting ? "Posting..." : "Submit"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Posts */}
          <div className="space-y-4">
            {filteredPosts.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No posts yet. Be the first!</p>
              </div>
            )}
            {filteredPosts.map((post, i) => {
              const myVote = votes.find((v) => v.post_id === post.id);
              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-4 flex gap-4"
                >
                  {/* Vote */}
                  <div className="flex flex-col items-center gap-1 min-w-[40px]">
                    <motion.button
                      whileTap={{ scale: 1.3 }}
                      onClick={() => handleVote(post.id, 1)}
                      className={`p-1 rounded transition-colors ${myVote?.vote_value === 1 ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <ArrowUp className="w-5 h-5" />
                    </motion.button>
                    <motion.span
                      key={post.score}
                      initial={{ scale: 1.3 }}
                      animate={{ scale: 1 }}
                      className="text-sm font-bold text-foreground"
                    >
                      {post.score}
                    </motion.span>
                    <motion.button
                      whileTap={{ scale: 1.3 }}
                      onClick={() => handleVote(post.id, -1)}
                      className={`p-1 rounded transition-colors ${myVote?.vote_value === -1 ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <ArrowDown className="w-5 h-5" />
                    </motion.button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-foreground font-semibold">{post.title}</h3>
                    {post.content && <p className="text-muted-foreground text-sm mt-1 line-clamp-3">{post.content}</p>}
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">{(post as any).profiles?.username || "unknown"}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </main>

        {/* Right Sidebar - Members */}
        <aside className="hidden md:flex w-64 flex-col border-l border-border p-4 fixed top-16 right-0 bottom-0 overflow-y-auto bg-background/50 backdrop-blur-md">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 px-2">
            Members · {members.length}
          </p>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/20 transition-colors">
                {(m as any).profiles?.avatar_url ? (
                  <img src={(m as any).profiles.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold">
                    {(m as any).profiles?.username?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <span className="text-sm text-foreground">{(m as any).profiles?.username || "Unknown"}</span>
                <div className="ml-auto w-2 h-2 rounded-full bg-primary/70" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MainApp;
