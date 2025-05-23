
import { useState, useEffect, useRef } from "react";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { getAutoCompleteSuggestions } from "@/services/chatHistoryService";

interface QuestionAutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (question: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function QuestionAutoComplete({
  value,
  onChange,
  onSelect,
  placeholder = "Ask a question...",
  disabled = false,
  className = ""
}: QuestionAutoCompleteProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value.length >= 2) {
      const newSuggestions = getAutoCompleteSuggestions(value, 5);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value]);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
  };

  const handleSelectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    onSelect(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Command className="relative">
        <CommandInput
          ref={inputRef}
          value={value}
          onValueChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="border-0 shadow-none focus:ring-0"
        />
        
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-md shadow-lg">
            <CommandList>
              <CommandEmpty>No suggestions found.</CommandEmpty>
              {suggestions.map((suggestion, index) => (
                <CommandItem
                  key={index}
                  onSelect={() => handleSelectSuggestion(suggestion)}
                  className="cursor-pointer"
                >
                  {suggestion}
                </CommandItem>
              ))}
            </CommandList>
          </div>
        )}
      </Command>
    </div>
  );
}
