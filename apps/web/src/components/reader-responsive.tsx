import { useState, useRef } from 'react'
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { ScrollArea } from "./ui/scroll-area"
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog"
import { ChevronLeftIcon, ChevronRightIcon, MenuIcon } from 'lucide-react'

export default function ReaderMobileFirst() {
  const [view, setView] = useState('FEEDS')
  const [selectedFeed, setSelectedFeed] = useState(null)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [showRawFeed, setShowRawFeed] = useState(false)
  const [command, setCommand] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [compactMode, setCompactMode] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const commandInputRef = useRef(null)

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

  // return (
  //   <div className="flex flex-col h-screen bg-white text-black font-mono text-xs" style={{ fontFamily: 'Courier, monospace' }}>
  //     {/* Command Bar */}
  //     <div className="p-2 border-b-4 border-black flex items-center space-x-2">
  //       <Button variant="outline" className="border-2 border-black rounded-none p-2 md:hidden" onClick={() => setView('FEEDS')}>
  //         <MenuIcon size={16} />
  //       </Button>
  //       <Input
  //         ref={commandInputRef}
  //         className="flex-grow border-2 border-black rounded-none"
  //         placeholder="ENTER COMMAND OR SEARCH QUERY"
  //         value={command}
  //         onChange={(e) => setCommand(e.target.value)}
  //         onKeyPress={(e) => {
  //           if (e.key === 'Enter') {
  //             handleCommand(command)
  //             setCommand('')
  //           }
  //         }}
  //       />
  //       <Button variant="outline" className="border-2 border-black rounded-none hover:bg-gray-100 hidden md:inline-flex" onClick={() => setShowHelp(true)}>
  //         [HELP]
  //       </Button>
  //     </div>

  //     {/* Main Content */}
  //     <div className="flex-grow flex flex-col md:flex-row">
  //       {/* Feed List */}
  //       <div className={`w-full md:w-1/4 border-r-4 border-black overflow-auto ${view !== 'FEEDS' ? 'hidden md:block' : ''} ${focusMode ? 'md:hidden' : ''}`}>
  //         <div className="p-2 border-b-4 border-black font-bold">FEEDS</div>
  //         {feeds.map((feed) => (
  //           <button
  //             key={feed.id}
  //             className={`w-full text-left p-2 hover:bg-gray-100 border-b-2 border-black ${selectedFeed === feed.id ? 'bg-gray-200' : ''}`}
  //             onClick={() => {
  //               setSelectedFeed(feed.id)
  //               setView('ARTICLES')
  //             }}
  //           >
  //             {feed.name} ({feed.unread})
  //             <div className="text-xs text-gray-500 truncate">{feed.url}</div>
  //           </button>
  //         ))}
  //       </div>

  //       {/* Article List */}
  //       <div className={`w-full md:w-1/3 border-r-4 border-black overflow-auto ${view !== 'ARTICLES' ? 'hidden md:block' : ''} ${focusMode ? 'md:hidden' : ''}`}>
  //         <div className="p-2 border-b-4 border-black font-bold">ARTICLES</div>
  //         {articles.filter(a => a.feedId === selectedFeed).map((article) => (
  //           <button
  //             key={article.id}
  //             className={`w-full text-left p-2 hover:bg-gray-100 border-b-2 border-black ${selectedArticle === article.id ? 'bg-gray-200' : ''}`}
  //             onClick={() => {
  //               setSelectedArticle(article.id)
  //               setView('CONTENT')
  //             }}
  //           >
  //             <div className="font-bold">{article.title}</div>
  //             <div className="text-xs text-gray-500">{article.date}</div>
  //             {!compactMode && (
  //               <>
  //                 <div className="text-sm mt-2 p-2 border-l-2 border-black">
  //                   {article.summary}
  //                 </div>
  //                 <div className="text-xs mt-2">
  //                   KEY_POINTS: {article.keyPoints.join(' | ')}
  //                 </div>
  //               </>
  //             )}
  //           </button>
  //         ))}
  //       </div>

  //       {/* Article Content */}
  //       <ScrollArea className={`w-full ${focusMode ? 'md:w-full' : 'md:w-5/12'} ${view !== 'CONTENT' ? 'hidden md:block' : ''}`}>
  //         {selectedArticle && (
  //           <article className="p-4">
  //             <h2 className="text-lg font-bold mb-2">{articles.find(a => a.id === selectedArticle)?.title}</h2>
  //             <p className="text-xs mb-4">{articles.find(a => a.id === selectedArticle)?.date}</p>
  //             <div className="mb-4 p-2 border-2 border-black">
  //               <div className="font-bold">SUMMARY:</div>
  //               <div>{articles.find(a => a.id === selectedArticle)?.summary}</div>
  //               <div className="font-bold mt-2">KEY_POINTS:</div>
  //               <ul className="list-disc pl-5">
  //                 {articles.find(a => a.id === selectedArticle)?.keyPoints.map((point, index) => (
  //                   <li key={index}>{point}</li>
  //                 ))}
  //               </ul>
  //             </div>
  //             {showRawFeed ? (
  //               <pre className="whitespace-pre-wrap border-2 border-black p-2">
  //                 {articles.find(a => a.id === selectedArticle)?.rawContent}
  //               </pre>
  //             ) : (
  //               <p>{articles.find(a => a.id === selectedArticle)?.content}</p>
  //             )}
  //           </article>
  //         )}
  //       </ScrollArea>
  //     </div>

  //     {/* Navigation Bar (Mobile Only) */}
  //     <div className="p-2 border-t-4 border-black flex justify-between items-center md:hidden">
  //       <Button
  //         variant="outline"
  //         className="border-2 border-black rounded-none"
  //         onClick={() => setView(view === 'ARTICLES' ? 'FEEDS' : 'ARTICLES')}
  //         disabled={view === 'FEEDS'}
  //       >
  //         <ChevronLeftIcon size={16} />
  //       </Button>
  //       <span>{view}</span>
  //       <Button
  //         variant="outline"
  //         className="border-2 border-black rounded-none"
  //         onClick={() => setShowRawFeed(!showRawFeed)}
  //       >
  //         [{showRawFeed ? 'HIDE RAW' : 'SHOW RAW'}]
  //       </Button>
  //     </div>

  //     {/* Status Bar (Desktop Only) */}
  //     <div className="p-2 border-t-4 border-black justify-between items-center hidden md:flex">
  //       <span>SELECTED FEED: {feeds.find(f => f.id === selectedFeed)?.name || 'NONE'}</span>
  //       <span>ARTICLES: {articles.filter(a => a.feedId === selectedFeed).length}</span>
  //       <span>MODE: {showRawFeed ? 'RAW' : 'FORMATTED'} | {compactMode ? 'COMPACT' : 'FULL'} | {focusMode ? 'FOCUS' : 'NORMAL'}</span>
  //     </div>

  //     {/* Help Dialog */}
  //     <Dialog open={showHelp} onOpenChange={setShowHelp}>
  //       <DialogContent className="bg-white border-4 border-black p-0">
  //         <div className="p-4 border-b-4 border-black font-bold">AVAILABLE COMMANDS</div>
  //         <ScrollArea className="h-[300px]">
  //           {commands.map((cmd, index) => (
  //             <div key={index} className="p-4 border-b-2 border-black">
  //               <div className="font-bold">{cmd.name}</div>
  //               <div className="text-sm">{cmd.description}</div>
  //             </div>
  //           ))}
  //         </ScrollArea>
  //       </DialogContent>
  //     </Dialog>
  //   </div>
  // )

  return (
    <div className="flex flex-col h-screen bg-white text-black font-mono text-xs">
      {/* Command Bar - Always visible */}
      <div className="p-2 border-b-4 border-black flex items-center space-x-2">
        <Button variant="outline" className="border-2 border-black rounded-none p-2 md:hidden" onClick={() => setView('FEEDS')}>
          <MenuIcon size={16} />
        </Button>
        <Input
          ref={commandInputRef}
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
        <Button variant="outline" className="border-2 border-black rounded-none hover:bg-gray-100" onClick={() => setShowHelp(true)}>
          [HELP]
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-grow flex md:flex-row">
        {/* Feed List */}
        <div className={`w-full md:w-1/3 border-r-4 border-black overflow-auto ${view !== 'FEEDS' ? 'hidden md:block' : ''}`}>
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

        {/* Article List */}
        <div className={`w-full md:w-1/3 border-r-4 border-black overflow-auto ${view !== 'ARTICLES' ? 'hidden md:block' : ''}`}>
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
            </button>
          ))}
        </div>

        {/* Article Content */}
        <ScrollArea className={`w-full md:w-1/3 ${view !== 'CONTENT' ? 'hidden md:block' : ''}`}>
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

      {/* Navigation Bar (Mobile Only) */}
      <div className="p-2 border-t-4 border-black flex justify-between items-center md:hidden">
        <Button
          variant="outline"
          className="border-2 border-black rounded-none"
          onClick={() => setView(view === 'ARTICLES' ? 'FEEDS' : (view === 'CONTENT' ? 'ARTICLES' : 'FEEDS'))}
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
