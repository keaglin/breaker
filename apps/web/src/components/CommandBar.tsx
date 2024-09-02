import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

interface CommandBarProps {
  commands: string[];
  articles: { id: number; title: string }[];
  onCommand: (command: string) => void;
  onArticleSelect: (articleId: number) => void;
}

export function CommandBar({ commands, articles, onCommand, onArticleSelect }: CommandBarProps) {
  const [input, setInput] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<Array<{ type: 'command' | 'article', value: string, id?: number }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) {
        event.preventDefault()
        inputRef.current?.focus()
        setInput('/')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (input.startsWith('/')) {
      const filteredCommands = commands.filter(cmd => cmd.toLowerCase().includes(input.slice(1).toLowerCase()));
      setResults(filteredCommands.map(cmd => ({ type: 'command', value: cmd })));
    } else if (input) {
      const filteredArticles = articles.filter(article => article.title.toLowerCase().includes(input.toLowerCase()));
      setResults(filteredArticles.map(article => ({ type: 'article', value: article.title, id: article.id })));
    } else {
      setResults([]);
    }
    setShowResults(input !== '');
  }, [input, commands, articles]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && results.length > 0) {
      handleResultClick(results[0]);
    }
  };

  const handleResultClick = (result: { type: 'command' | 'article', value: string, id?: number }) => {
    if (result.type === 'command') {
      onCommand(result.value);
    } else if (result.type === 'article' && result.id !== undefined) {
      onArticleSelect(result.id);
    }
    setInput('');
    setShowResults(false);
  };

  return (
    <div className="relative w-full">
      <div className="flex items-center space-x-2">
        <Input
          ref={inputRef}
          className="flex-grow border-2 border-black rounded-none"
          placeholder="ENTER COMMAND OR SEARCH QUERY (Press '/' for commands)"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
        />
        <Button
          variant="outline"
          className="border-2 border-black rounded-none"
          onClick={() => {
            setInput('/');
            inputRef.current?.focus();
          }}
        >
          [CMD]
        </Button>
      </div>
      {showResults && (
        <div className="absolute z-10 w-full mt-1 bg-white border-2 border-black">
          <ScrollArea className="h-64">
            {results.map((result, index) => (
              <Button
                key={index}
                variant="ghost"
                className="w-full justify-start rounded-none hover:bg-gray-100"
                onClick={() => handleResultClick(result)}
              >
                [{result.type === 'command' ? 'CMD' : 'ART'}] {result.value}
              </Button>
            ))}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
