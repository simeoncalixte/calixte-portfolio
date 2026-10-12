/** Detailed skills chapters grounded in the portfolio's existing experience. */
export const SKILL_JOURNEY = [
  {id:'skills-analytics', title:'Data analytics & pipelines', short:'DATA & PIPELINES', color:'#ffc570', symbol:'01',
    tools:['Python','SQL','MySQL','Elasticsearch','AWS S3','Amazon SP-API'], examples:['sparks','prowinch'],
    intro:'Follow data from its source to a useful application. My experience connects APIs, business logic, search, and inventory systems so that information can move between products.',
    stages:['Collect','Transform','Deliver'],
    topics:[
      ['Collect & connect','Integrate external APIs with existing systems, identify the records an application needs, and translate source data into a usable contract. At Prowinch, I integrated Amazon’s Selling Partner API with the existing inventory infrastructure.'],
      ['Transform & organize','Use Python, SQL, and backend business logic to organize data for application workflows. My work at sparks & honey combined APIs and middleware with MySQL, Elasticsearch, Python, and AWS services.'],
      ['Analyze & make useful','Query structured data, make information searchable, and expose it to interfaces that help users understand their work. This experience is rooted in application data and integrations; it is the foundation for my approach to analytics and data pipelines.'],
    ]},
  {id:'skills-platform',title:'APIs, servers, databases & infrastructure',short:'APIs & INFRASTRUCTURE',color:'#b59aff',symbol:'02',
    tools:['Node.js','Express','REST','PHP','MySQL','Elasticsearch','AWS','NGINX','Swagger','Jest'],examples:['sparks','manit','prowinch','cbs'],
    intro:'Explore the services behind the interface: API contracts, server-side rules, persistence, and deployment. I connect these layers into maintainable applications.',
    stages:['Request','Process','Persist'],
    topics:[
      ['APIs & server logic','Build Node.js / Express endpoints and business-logic controllers, connect external services, and document contracts. At sparks & honey I built APIs and middleware; at CBS Interactive, on contract through Workforce Logic, I worked on REST APIs and Swagger documentation.'],
      ['Databases & search','Work with MySQL, PostgreSQL, MSSQL, and Elasticsearch as part of the application stack. Organize access around the information each workflow needs and keep the interface, API, and stored data consistent.'],
      ['Infrastructure & delivery','At ManitLabs I connected remote desktops through NGINX and wrapped cloud storage and authentication APIs. At Prowinch I configured IAM users, policies, and roles. My delivery toolkit includes AWS, Linux, testing, and CI/CD workflows.'],
    ]},
  {id:'skills-ui',title:'UI & frontend engineering',short:'UI ENGINEERING',color:'#61dafb',symbol:'03',
    tools:['React','JavaScript','HTML5','CSS3','Redux','Storybook','Styled Components','Jest'],examples:['manit','xbox','geeks'],
    intro:'Turn application capabilities into interfaces people can use. My frontend work spans reusable components, responsive layouts, legacy modernization, and teaching full stack development.',
    stages:['Compose','Interact','Refine'],
    topics:[
      ['Reusable interfaces','Build React components and compose them into coherent application flows. At ManitLabs I developed React interfaces and Storybook testing workflows while leading a five-person development team.'],
      ['State & interactions','Connect UI state with services, handle user input, and keep feedback understandable. My toolkit includes React, Redux, JavaScript, semantic HTML, CSS, and component libraries.'],
      ['Maintain & improve','At Microsoft Xbox, on contract through TEKsystems, I maintained legacy frontend applications, resolved user-flow issues, and refactored for performance and maintainability. I also taught practical interface development at 4Geeks Academy.'],
    ]},
  {id:'skills-visualization',title:'Visualization & explaining information',short:'VISUALIZATION',color:'#85e2ab',symbol:'04',
    tools:['JavaScript','React','HTML5 / CSS3','Interactive interfaces','Technical documentation'],examples:['sparks','manit','geeks'],
    intro:'Make complex systems easier to understand through clear visual structure and interaction. This island connects my interface development and teaching experience with the way this portfolio explains my work.',
    stages:['Structure','Explore','Understand'],
    topics:[
      ['Structure the story','Choose a clear hierarchy, group related information, and give users a useful starting point. My teaching experience helps me break technical topics into smaller, connected steps.'],
      ['Interactive exploration','Use interface state and reusable components to let people explore information progressively. The islands in this portfolio are an example: visitors can move from a broad topic to a detailed explanation and then to related experience.'],
      ['Context & clarity','Give visual information readable labels, useful context, and a path back to the underlying work. Connect the explanation to concrete examples, technical documentation, and the decisions behind the interface.'],
    ]},
];
