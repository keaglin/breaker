import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent } from "@/components/ui/dialog"

export default function Component({ feeds, articles }) {
  const [view, setView] = useState('FEEDS')
  const [selectedFeed, setSelectedFeed] = useState(null)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [showRawFeed, setShowRawFeed] = useState(false)
  const [command, setCommand] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [compactMode, setCompactMode] = useState(false)
  const commandInputRef = useRef(null)

  // const feeds = [
  //   { id: 1, name: "TECH_NEWS", unread: 5, url: "https://technews.com/rss" },
  //   { id: 2, name: "WORLD_EVENTS", unread: 3, url: "https://worldevents.com/rss" },
  //   { id: 3, name: "DESIGN_TRENDS", unread: 1, url: "https://designtrends.com/rss" },
  // ]

  // const articles = [
  //   {
  //     id: 1,
  //     feedId: 1,
  //     title: "AI IN WEB DEV",
  //     content: "AI is changing how we build websites. This article explores the latest trends and technologies in AI-assisted web development, discussing the potential benefits and challenges of integrating AI into the web development workflow.",
  //     date: "2023-06-15",
  //     rawContent: "<item><title>AI IN WEB DEV</title><description>AI is changing how we build websites...</description><pubDate>2023-06-15</pubDate></item>",
  //     summary: "AI tools are revolutionizing web development processes.",
  //     keyPoints: ["Increased efficiency", "New design paradigms", "Ethical considerations"]
  //   },
  //   {
  //     id: 2,
  //     feedId: 1,
  //     title: "THE RISE OF WEBASSEMBLY",
  //     content: "WebAssembly is gaining traction as a powerful tool for high-performance web applications. This article delves into the basics of WebAssembly, its advantages over traditional JavaScript, and real-world use cases demonstrating its potential.",
  //     date: "2023-06-14",
  //     rawContent: "<item><title>THE RISE OF WEBASSEMBLY</title><description>WebAssembly is gaining traction...</description><pubDate>2023-06-14</pubDate></item>",
  //     summary: "WebAssembly is becoming a game-changer for web performance.",
  //     keyPoints: ["Near-native speed", "Language-agnostic", "Seamless JavaScript integration"]
  //   },
  // ]

  const commands = [
    { name: "SEARCH <query>", description: "Search feeds and articles" },
    { name: "ADD_FEED <url>", description: "Add a new RSS feed" },
    { name: "REFRESH", description: "Refresh all feeds" },
    { name: "TOGGLE_RAW", description: "Toggle between raw and formatted content" },
    { name: "COMPACT", description: "Toggle compact mode" },
    { name: "HELP", description: "Show help information" },
  ]

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        event.preventDefault()
        commandInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleCommand = (cmd) => {
    const [command, ...args] = cmd.split(' ')
    switch (command.toUpperCase()) {
      case 'SEARCH':
        // Implement search functionality
        break
      case 'ADD_FEED':
        // Implement add feed functionality
        break
      case 'REFRESH':
        // Implement refresh functionality
        break
      case 'TOGGLE_RAW':
        setShowRawFeed(!showRawFeed)
        break
      case 'COMPACT':
        setCompactMode(!compactMode)
        break
      case 'HELP':
        setShowSettings(true)
        break
      default:
      // Handle unknown command
    }
  }

  const renderFeeds = () => (
    <div className="border-r-4 border-black h-full overflow-auto">
      <div className="p-2 border-b-4 border-black font-bold">FEEDS</div>
      {feeds.map((feed) => (
        <button
          key={feed.id}
          className={`w-full text-left p-2 hover:bg-gray-100 border-b-2 border-black ${selectedFeed === feed.id ? 'bg-gray-200' : ''}`}
          onClick={() => {
            setSelectedFeed(feed.id)
            setView('ARTICLES')
          }}
        >
          {feed.name} ({feed.unread})
          <div className="text-xs text-gray-500 truncate">{feed.url}</div>
        </button>
      ))}
    </div>
  )

  const renderArticles = () => (
    <div className="border-r-4 border-black h-full overflow-auto">
      <div className="p-2 border-b-4 border-black font-bold">ARTICLES</div>
      {articles.filter(a => a.feedId === selectedFeed).map((article) => (
        <button
          key={article.id}
          className={`w-full text-left p-2 hover:bg-gray-100 border-b-2 border-black ${selectedArticle === article.id ? 'bg-gray-200' : ''}`}
          onClick={() => {
            setSelectedArticle(article.id)
            setView('CONTENT')
          }}
        >
          <div className="font-bold">{article.title}</div>
          <div className="text-xs text-gray-500">{article.date}</div>
          {!compactMode && (
            <>
              <div className="text-sm mt-2 p-2 border-l-2 border-black">
                {article.summary}
              </div>
              <div className="text-xs mt-2">
                KEY_POINTS: {article.keyPoints.slice(0, 3).join(' | ')}
              </div>
            </>
          )}
        </button>
      ))}
    </div>
  )

  const renderContent = () => {
    const article = articles.find(a => a.id === selectedArticle)
    return article ? (
      <ScrollArea className="h-full p-4">
        <h2 className="text-lg font-bold mb-2">{article.title}</h2>
        <p className="text-xs mb-4">{article.date}</p>
        <div className="mb-4 p-2 border-2 border-black">
          <div className="font-bold">SUMMARY:</div>
          <div>{article.summary}</div>
          <div className="font-bold mt-2">KEY_POINTS:</div>
          <ul className="list-disc pl-5">
            {article.keyPoints.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
          <div className="font-bold mt-2">TAKEAWAYS:</div>
          <ul className="list-disc pl-5">
            {article.takeaways.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
        </div>
        {showRawFeed ? (
          <pre className="whitespace-pre-wrap border-2 border-black p-2">
            {article.rawContent}
          </pre>
        ) : (
          <p>{article.content}</p>
        )}
      </ScrollArea>
    ) : null
  }

  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="bg-white border-4 border-black p-0 w-full max-w-full h-full max-h-full m-0">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b-4 border-black font-bold">SETTINGS</div>
          <ScrollArea className="flex-grow">
            <div className="p-4 border-b-2 border-black">
              <Button
                variant="outline"
                className="w-full border-2 border-black rounded-none"
                onClick={() => setShowRawFeed(!showRawFeed)}
              >
                [TOGGLE RAW FEED: {showRawFeed ? 'ON' : 'OFF'}]
              </Button>
            </div>
            <div className="p-4 border-b-2 border-black">
              <Button
                variant="outline"
                className="w-full border-2 border-black rounded-none"
                onClick={() => setCompactMode(!compactMode)}
              >
                [COMPACT MODE: {compactMode ? 'ON' : 'OFF'}]
              </Button>
            </div>
            <div className="p-4 border-b-4 border-black font-bold">HELP</div>
            {commands.map((cmd, index) => (
              <div key={index} className="p-4 border-b-2 border-black">
                <div className="font-bold">{cmd.name}</div>
                <div className="text-sm">{cmd.description}</div>
              </div>
            ))}
          </ScrollArea>
          <div className="p-4 border-t-4 border-black">
            <Button
              variant="outline"
              className="w-full border-2 border-black rounded-none"
              onClick={() => setShowSettings(false)}
            >
              [CLOSE]
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="flex flex-col h-screen bg-white text-black font-mono text-xs" style={{ fontFamily: 'Courier, monospace' }}>
      {/* Command Bar */}
      <div className="sticky top-0 z-10 bg-white p-2 border-b-4 border-black flex items-center space-x-2">
        <Button
          variant="outline"
          className="border-2 border-black rounded-none"
          onClick={() => setShowSettings(true)}
        >
          [SETTINGS]
        </Button>
        <Input
          ref={commandInputRef}
          className="flex-grow border-2 border-black rounded-none"
          placeholder="ENTER COMMAND OR SEARCH QUERY (Press '/' to focus)"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleCommand(command)
              setCommand('')
            }
          }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-grow flex overflow-hidden">
        {/* Desktop Layout */}
        <div className="hidden md:flex w-full">
          <div className="w-1/4">{renderFeeds()}</div>
          <div className="w-1/3">{renderArticles()}</div>
          <div className="w-5/12">{renderContent()}</div>
        </div>

        {/* Mobile Layout */}
        <div className="flex md:hidden w-full">
          <div className="w-full h-full overflow-auto">
            {view === 'FEEDS' && renderFeeds()}
            {view === 'ARTICLES' && renderArticles()}
            {view === 'CONTENT' && renderContent()}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="md:hidden sticky bottom-0 z-10 bg-white p-2 border-t-4 border-black flex justify-between items-center">
        <Button
          variant="outline"
          className="border-2 border-black rounded-none"
          onClick={() => {
            if (view === 'CONTENT') setView('ARTICLES')
            else if (view === 'ARTICLES') setView('FEEDS')
          }}
          disabled={view === 'FEEDS'}
        >
          [BACK]
        </Button>
        <span className="text-center">{view}</span>
        <Button
          variant="outline"
          className="border-2 border-black rounded-none"
          onClick={() => setShowSettings(true)}
        >
          [HELP]
        </Button>
      </div>

      {/* Desktop Status Bar */}
      <div className="hidden md:flex sticky bottom-0 z-10 bg-white p-2 border-t-4 border-black justify-between items-center">
        <span>SELECTED FEED: {feeds.find(f => f.id === selectedFeed)?.name || 'NONE'}</span>
        <span>ARTICLES: {articles.filter(a => a.feedId === selectedFeed).length}</span>
        <span>MODE: {showRawFeed ? 'RAW' : 'FORMATTED'} | {compactMode ? 'COMPACT' : 'FULL'}</span>
      </div>

      {/* Settings Dialog */}
      {renderSettings()}
    </div>
  )
}
