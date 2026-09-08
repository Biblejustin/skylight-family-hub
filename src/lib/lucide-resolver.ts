import type { LucideIcon } from 'lucide-react';
import {
  // Icons already used in module-registry.ts
  Clock, CalendarDays, CloudSun, Hourglass, Laugh, Type, ImageIcon,
  Quote, ListTodo, StickyNote, HandMetal,
  Newspaper, TrendingUp, Bitcoin, BookOpen, History,
  Moon, Sunrise, Image, QrCode, BarChart3, Car, Trophy, Wind,
  ListChecks, CloudRain, CalendarRange, Trash2, Medal, Sparkles,
  Calendar, Globe, UtensilsCrossed, Flag, ClipboardList,
  // Additional curated icons for plugins (~20 originals)
  Puzzle, Radar, Music, Tv, Radio, Gauge, Thermometer, Droplets,
  Zap, Bell, MapPin, Navigation, Wifi, Heart, Star,
  Camera, Video, Mic, Volume2, Headphones, Monitor,
  // Smart Home
  Lightbulb, Lock, Unlock, Bluetooth, Speaker,
  // Health & Fitness
  Activity, Dumbbell, Apple, Pill,
  // Social & Communication
  MessageCircle, Mail, Phone, Share2, Users,
  // Development
  Code, Terminal, Database, Server, GitBranch, Bug,
  // Media
  Film,
  // Misc
  Palette, Shield, Bookmark, Pin, Map,
  Plane, Train, Bus, Bike, Coffee, ShoppingCart, Package,
  // Additional useful icons
  Eye, EyeOff, Settings, Search, Filter, Download, Upload,
  RefreshCw, RotateCw, Maximize, Minimize, Plus, Minus,
  Check, X, AlertTriangle, Info, HelpCircle,
  Home, Folder, File, FileText, Link, ExternalLink,
  Sun, Cloud, Snowflake, Umbrella,
  Tag, Hash, AtSign, Percent,
  ChevronRight, ChevronDown, ArrowUp, ArrowDown,
  LayoutGrid, List, Table, Columns,
  Power, Battery, Cpu, HardDrive, Smartphone,
  Gift, Award, Crown, Flame, Target, Compass,
} from 'lucide-react';

/**
 * Curated icon map — ~120 icons covering common categories.
 * Importing all ~1400 Lucide icons would add ~200KB.
 * Unknown icon names fall back to Puzzle.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  // Built-in module icons
  Clock, CalendarDays, CloudSun, Hourglass, Laugh, Type, ImageIcon,
  Quote, ListTodo, StickyNote, HandMetal,
  Newspaper, TrendingUp, Bitcoin, BookOpen, History,
  Moon, Sunrise, Image, QrCode, BarChart3, Car, Trophy, Wind,
  ListChecks, CloudRain, CalendarRange, Trash2, Medal, Sparkles,
  Calendar, Globe, UtensilsCrossed, Flag, ClipboardList,
  // Original extras
  Puzzle, Radar, Music, Tv, Radio, Gauge, Thermometer, Droplets,
  Zap, Bell, MapPin, Navigation, Wifi, Heart, Star,
  Camera, Video, Mic, Volume2, Headphones, Monitor,
  // Smart Home
  Lightbulb, Lock, Unlock, Bluetooth, Speaker,
  // Health & Fitness
  Activity, Dumbbell, Apple, Pill,
  // Social & Communication
  MessageCircle, Mail, Phone, Share2, Users,
  // Development
  Code, Terminal, Database, Server, GitBranch, Bug,
  // Media
  Film,
  // Misc
  Palette, Shield, Bookmark, Pin, Map,
  Plane, Train, Bus, Bike, Coffee, ShoppingCart, Package,
  // UI & Actions
  Eye, EyeOff, Settings, Search, Filter, Download, Upload,
  RefreshCw, RotateCw, Maximize, Minimize, Plus, Minus,
  Check, X, AlertTriangle, Info, HelpCircle,
  // Files & Navigation
  Home, Folder, File, FileText, Link, ExternalLink,
  // Weather extras
  Sun, Cloud, Snowflake, Umbrella,
  // Labels & Symbols
  Tag, Hash, AtSign, Percent,
  // Directional
  ChevronRight, ChevronDown, ArrowUp, ArrowDown,
  // Layout
  LayoutGrid, List, Table, Columns,
  // Hardware
  Power, Battery, Cpu, HardDrive, Smartphone,
  // Achievement & Misc
  Gift, Award, Crown, Flame, Target, Compass,
};

/** Resolve a lucide icon name string to a component. Falls back to Puzzle for unknown names. */
export function resolveLucideIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Puzzle;
}
