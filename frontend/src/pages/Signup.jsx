import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSignup() {
    setError("");
    try {
      const res = await api.post("/auth/signup", { name, email, password });
      login(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Signup failed");
    }
  }

  return (
    <div className="h-screen bg-black flex justify-center items-center">
      <div className="bg-zinc-900 p-8 rounded-xl w-96">
        <h2 className="text-3xl mb-5">Signup</h2>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 mb-3 rounded bg-zinc-800"
          placeholder="Name"
        />

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 mb-3 rounded bg-zinc-800"
          placeholder="Email"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 mb-3 rounded bg-zinc-800"
          placeholder="Password"
          onKeyDown={(e) => e.key === "Enter" && handleSignup()}
        />

        <button
          onClick={handleSignup}
          className="w-full bg-red-600 p-3 rounded"
        >
          Signup
        </button>

        <p className="text-sm text-gray-500 mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-purple-400">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
