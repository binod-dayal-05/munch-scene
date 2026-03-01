import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { auth } from "./firebase";

export const loginWithEmailPassword = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const signupWithEmailPassword = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const logoutFromMunchscene = () => signOut(auth);
