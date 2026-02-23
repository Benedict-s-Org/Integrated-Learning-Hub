import {
    Heart, Star, Zap, Trophy, BookOpen, Users,
    AlertCircle, Clock, XCircle, Check,
    Lightbulb, Flame, Award, ThumbsUp, Medal, Crown, Target,
    Smile, Frown, AlertTriangle, Ban,
    Gift, Rocket, Gem, PartyPopper, ShieldCheck, Sun, Moon,
    Compass, Music, Gamepad2, Camera, Palette, Coffee,
    Pizza, IceCream, Apple, Cherry, Banana, Bike, Car, Plane,
    Cloud, Rainbow, Ghost, Cat, Dog, Rabbit, ThumbsDown,
    Skull, CloudRain, Bomb, CloudOff, ZapOff, ShieldAlert,
    VolumeX, WifiOff, Trash, History, UserMinus, UserX,
    ShieldX, Flag, Anchor, Key, Hammer, Wrench, Search,
    Bell, Mail, Link, MapPin, Clipboard, Calendar, Briefcase,
    Glasses, Ear, Eye, HandMetal, HeartHandshake, Mic,
    MessageSquare, Send, Share2, Sparkles, Wand2
} from 'lucide-react';

export const REWARD_ICON_MAP: Record<string, any> = {
    // Frequently Chosen / Positive
    Star, Heart, Trophy, Medal, Award, Crown, Thumbup: ThumbsUp, Zap, Sparkles, PartyPopper, Gift, Gem, Rocket, Target, Smile,
    // Academic / Behavior
    BookOpen, Lightbulb, Clock, Check, ShieldCheck, Flag, Users,
    // Hobbies / Fun
    Music, Mic, Gamepad2, Palette, Camera, Wand2, Ghost,
    // Daily Life / Food
    Coffee, Pizza, IceCream, Apple, Cherry, Banana,
    // Nature / Travel
    Flame, Sun, Moon, Rainbow, Cloud, Rain: CloudRain, Compass, MapPin, Bike, Car, Plane,
    // Animals
    Cat, Dog, Rabbit,
    // Neutral / Tools
    Search, Bell, Mail, Link, Clipboard, Calendar, Briefcase, Key, Hammer, Wrench, Glasses, Ear, Eye, Anchor,
    // Community / Relationship
    HeartHandshake, HandMetal, MessageSquare, Send, Share2,
    // Consequences / Negative
    ThumbsDown, Frown, AlertCircle, AlertTriangle, Ban, XCircle, Skull, Bomb, CloudOff, ZapOff, ShieldAlert, ShieldX, VolumeX, WifiOff, UserMinus, UserX, Trash, History
};

export const REWARD_COLOR_OPTIONS = [
    { name: 'Pink', class: 'text-pink-500 bg-pink-100' },
    { name: 'Yellow', class: 'text-yellow-500 bg-yellow-100' },
    { name: 'Purple', class: 'text-purple-500 bg-purple-100' },
    { name: 'Blue', class: 'text-blue-500 bg-blue-100' },
    { name: 'Orange', class: 'text-orange-500 bg-orange-100' },
    { name: 'Green', class: 'text-green-500 bg-green-100' },
    { name: 'Red', class: 'text-red-500 bg-red-100' },
    { name: 'Gray', class: 'text-gray-500 bg-gray-100' },
    { name: 'Teal', class: 'text-teal-500 bg-teal-100' },
    { name: 'Indigo', class: 'text-indigo-500 bg-indigo-100' },
];

export const DEFAULT_SUB_OPTIONS: Record<string, string[]> = {
    "中文": ["預習冊", "詞語", "語基冊", "課練冊", "視聽冊", "實用冊", "作文", "補充", "閱補", "閱讀理解工作紙", "書練習"],
    "英文": ["WS1", "WS2", "WS3", "Pen", "GE(A)", "GE(B)", "Word Bank", "RWD", "Dict C/S", "Writing WS", "All-in-One", "Handwriting"],
    "數學": ["A簿", "B簿", "作業", "補充", "複工", "難工", "知多啲", "3下A 工", "3下b 工", "書"],
    "常識": [],
    "其他": []
};
