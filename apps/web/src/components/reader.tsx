import { useState, useEffect, useRef } from 'react'
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { ScrollArea } from "./ui/scroll-area"
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog"
import { ChevronLeftIcon, ChevronRightIcon, MenuIcon } from 'lucide-react'

export default function Component() {
  const [isMobile, setIsMobile] = useState(false)
  const [view, setView] = useState('FEEDS')
  const [selectedFeed, setSelectedFeed] = useState(null)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [showRawFeed, setShowRawFeed] = useState(false)
  const [command, setCommand] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [compactMode, setCompactMode] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const commandInputRef = useRef(null)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)

    // useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) {
        event.preventDefault()
        commandInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('resize', checkMobile)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const feeds = [
    { id: 1, name: "TECH_NEWS", unread: 5, url: "https://technews.com/rss" },
    { id: 2, name: "WORLD_EVENTS", unread: 3, url: "https://worldevents.com/rss" },
    { id: 3, name: "DESIGN_TRENDS", unread: 1, url: "https://designtrends.com/rss" },
  ]

  const articles = [
    {
      id: 1,
      feedId: 1,
      title: "AI IN WEB DEV",
      content: "AI is changing how we build websites...",
      date: "2023-06-15",
      rawContent: "<item><title>AI IN WEB DEV</title><description>AI is changing how we build websites...</description><pubDate>2023-06-15</pubDate></item>",
      summary: "AI tools are revolutionizing web development processes.",
      keyPoints: ["Increased efficiency", "New design paradigms", "Ethical considerations"]
    },
    // ... more articles ...
  ]

  const commands = [
    { name: "/", description: "Focus the command bar" },
    { name: "SEARCH <query>", description: "Search feeds and articles" },
    { name: "ADD_FEED <url>", description: "Add a new RSS feed" },
    { name: "REFRESH", description: "Refresh all feeds" },
    { name: "TOGGLE_RAW", description: "Toggle between raw and formatted content" },
    { name: "COMPACT", description: "Toggle compact mode" },
    { name: "FOCUS", description: "Toggle focus mode" },
    { name: "HELP", description: "Show this help menu" },
  ]

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
        console.log('REFRESH')
        break
      case 'TOGGLE_RAW':
        setShowRawFeed(!showRawFeed)
        break
      case 'COMPACT':
        setCompactMode(!compactMode)
        break
      case 'FOCUS':
        setFocusMode(!focusMode)
        break
      case 'HELP':
        setShowHelp(true)
        break
      default:
      // Handle unknown command
    }
  }

  const renderMobileView = () => {
    switch (view) {
      case 'FEEDS':
        return (
          <ScrollArea className="flex-grow">
            {feeds.map((feed) => (
              <button
                key={feed.id}
                className="w-full text-left p-4 border-b-2 border-black"
                onClick={() => { setSelectedFeed(feed.id); setView('ARTICLES'); }}
              >
                {feed.name} ({feed.unread})
                <div className="text-xs text-gray-500 truncate">{feed.url}</div>
              </button>
            ))}
          </ScrollArea>
        )
      case 'ARTICLES':
        return (
          <ScrollArea className="flex-grow">
            {articles.filter(a => a.feedId === selectedFeed).map((article) => (
              <button
                key={article.id}
                className="w-full text-left p-4 border-b-2 border-black"
                onClick={() => { setSelectedArticle(article.id); setView('CONTENT'); }}
              >
                {article.title}
                <div className="text-xs text-gray-500">{article.date}</div>
                <div className="text-sm mt-2 p-2 border-l-2 border-black">
                  {article.summary}
                </div>
                <div className="text-xs mt-2">
                  KEY_POINTS: {article.keyPoints.join(' | ')}
                </div>
              </button>
            ))}
          </ScrollArea>
        )
      case 'CONTENT':
        const article = articles.find(a => a.id === selectedArticle)
        return article ? (
          <ScrollArea className="flex-grow p-4">
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
  }

  const renderDesktopView = () => (
    <div className="flex-grow flex">
      {!focusMode && (
        <>
          {/* Feed List */}
          <div className="w-1/4 border-r-4 border-black overflow-auto">
            <div className="p-2 border-b-4 border-black font-bold">FEEDS</div>
            {feeds.map((feed) => (
              <button
                key={feed.id}
                className={`w-full text-left p-2 hover:bg-gray-100 border-b-2 border-black ${selectedFeed === feed.id ? 'bg-gray-200' : ''}`}
                onClick={() => setSelectedFeed(feed.id)}
              >
                {feed.name} ({feed.unread})
                <div className="text-xs text-gray-500 truncate">{feed.url}</div>
              </button>
            ))}
          </div>

          {/* Article List */}
          <div className="w-1/3 border-r-4 border-black overflow-auto">
            <div className="p-2 border-b-4 border-black font-bold">ARTICLES</div>
            {articles.filter(a => a.feedId === selectedFeed).map((article) => (
              <button
                key={article.id}
                className={`w-full text-left p-2 hover:bg-gray-100 border-b-2 border-black ${selectedArticle === article.id ? 'bg-gray-200' : ''}`}
                onClick={() => setSelectedArticle(article.id)}
              >
                <div className="font-bold">{article.title}</div>
                <div className="text-xs text-gray-500">{article.date}</div>
                {!compactMode && (
                  <>
                    <div className="text-sm mt-2 p-2 border-l-2 border-black">
                      {article.summary}
                    </div>
                    <div className="text-xs mt-2">
                      KEY_POINTS: {article.keyPoints.join(' | ')}
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Article Content */}
      <ScrollArea className={focusMode ? "w-full" : "w-5/12"}>
        {selectedArticle && (
          <article className="p-4">
            <h2 className="text-lg font-bold mb-2">{articles.find(a => a.id === selectedArticle)?.title}</h2>
            <p className="text-xs mb-4">{articles.find(a => a.id === selectedArticle)?.date}</p>
            <div className="mb-4 p-2 border-2 border-black">
              <div className="font-bold">SUMMARY:</div>
              <div>{articles.find(a => a.id === selectedArticle)?.summary}</div>
              <div className="font-bold mt-2">KEY_POINTS:</div>
              <ul className="list-disc pl-5">
                {articles.find(a => a.id === selectedArticle)?.keyPoints.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            </div>
            {showRawFeed ? (
              <pre className="whitespace-pre-wrap border-2 border-black p-2">
                {articles.find(a => a.id === selectedArticle)?.rawContent}
              </pre>
            ) : (
              <p>{articles.find(a => a.id === selectedArticle)?.content}</p>
            )}
          </article>
        )}
      </ScrollArea>
    </div>
  )

  return (
    <div className="flex flex-col h-screen bg-white text-black font-mono text-xs" style={{ fontFamily: 'Courier, monospace' }}>
      {/* Command Bar */}
      <div className="p-2 border-b-4 border-black flex items-center space-x-2">
        {isMobile && (
          <Button variant="outline" className="border-2 border-black rounded-none p-2" onClick={() => setView('FEEDS')}>
            <MenuIcon size={16} />
          </Button>
        )}
        <Input
          className="flex-grow border-2 border-black rounded-none"
          placeholder="ENTER COMMAND OR SEARCH QUERY"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleCommand(command)
              setCommand('')
            }
          }}
        />
        {!isMobile && (
          <Button variant="outline" className="border-2 border-black rounded-none hover:bg-gray-100" onClick={() => setShowHelp(true)}>
            [HELP]
          </Button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-grow flex flex-col">
        {isMobile ? renderMobileView() : renderDesktopView()}
      </div>

      {/* Navigation Bar (Mobile Only) */}
      {isMobile && (
        <div className="p-2 border-t-4 border-black flex justify-between items-center">
          <Button
            variant="outline"
            className="border-2 border-black rounded-none"
            onClick={() => setView(view === 'ARTICLES' ? 'FEEDS' : 'ARTICLES')}
            disabled={view === 'FEEDS'}
          >
            <ChevronLeftIcon size={16} />
          </Button>
          <span>{view}</span>
          <Button
            variant="outline"
            className="border-2 border-black rounded-none"
            onClick={() => setShowRawFeed(!showRawFeed)}
          >
            [{showRawFeed ? 'HIDE RAW' : 'SHOW RAW'}]
          </Button>
        </div>
      )}

      {/* Status Bar (Desktop Only) */}
      {!isMobile && (
        <div className="p-2 border-t-4 border-black flex justify-between items-center">
          <span>SELECTED FEED: {feeds.find(f => f.id === selectedFeed)?.name || 'NONE'}</span>
          <span>ARTICLES: {articles.filter(a => a.feedId === selectedFeed).length}</span>
          <span>MODE: {showRawFeed ? 'RAW' : 'FORMATTED'} | {compactMode ? 'COMPACT' : 'FULL'} | {focusMode ? 'FOCUS' : 'NORMAL'}</span>
        </div>
      )}

      {/* Help Dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="bg-white border-4 border-black p-0">
          <div className="p-4 border-b-4 border-black font-bold">AVAILABLE COMMANDS</div>
          <ScrollArea className="h-[300px]">
            {commands.map((cmd, index) => (
              <div key={index} className="p-4 border-b-2 border-black">
                <div className="font-bold">{cmd.name}</div>
                <div className="text-sm">{cmd.description}</div>
              </div>
            ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
