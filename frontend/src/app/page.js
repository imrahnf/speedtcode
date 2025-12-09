// frontend/src/app/page.js
"use client";
import TypingEngine from "@/components/typing/TypingEngine";

const MOCK_CODE = `def hello_world():
    print("Hello Speed(t)Code!")
    return True`;

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center  bg-[#DDFFF7] text-black font-sans">
      {/* You MUST pass the 'code' prop */}
      <TypingEngine 
        code={MOCK_CODE} 
        onFinish={(stats) => console.log(stats)} 
      />
    </main>
  );
}