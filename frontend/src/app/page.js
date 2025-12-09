// frontend/src/app/page.js
"use client";
import TypingEngine from "@/components/typing/TypingEngine";

const MOCK_CODE = `print("Hello, Speed(t)Code!")
'''
Speed(t)Code is an advanced typing test platform
You can test your typing speed with code snippets in various programming languages.
'''
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b
        
for num in fibonacci(10):
    print(num)
`;

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