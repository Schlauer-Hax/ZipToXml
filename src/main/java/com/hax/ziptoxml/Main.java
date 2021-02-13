package com.hax.ziptoxml;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import java.io.*;
import java.nio.file.Files;
import java.util.*;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

public class Main {

    public static void main(String[] args) {
        new Main().main();
    }

    /**
     * Gets all Files with .zip ending in current directory and calls scan method on them.
     */
    public void main() {
        // Gets All Files in current folder
        for (File file : Objects.requireNonNull(new File(".").listFiles())) {
            // Checks if Filename end with .zip
            if (file.getName().endsWith(".zip")) {
                // Starts the scan of the File
                scan(file);
            }
        }
    }

    /**
     * Scans file, extracts Zip file if needed and starts run method.
     *
     * @param file File ending with .zip
     */
    public void scan(File file) {
        try {
            // Gets File as zip file
            ZipFile zipFile = new ZipFile(file.getName());

            // Gets All Files inside the zip file
            ArrayList<? extends ZipEntry> entryList = Collections.list(zipFile.entries());

            // Checks if zip file contains zip file
            if (entryList.stream().anyMatch(entry -> entry.getName().endsWith(".zip"))) {
                // Gets Inputstream of zip file inside zip file
                InputStream stream = zipFile.getInputStream(entryList.stream().filter(entry -> entry.getName().endsWith(".zip")).findAny().get());

                // Reads zip file to buffer
                byte[] buffer = new byte[stream.available()];
                stream.read(buffer);

                // Writes zip file to new file in current directory
                File targetFile = new File(file.getName() + "2");
                OutputStream outStream = new FileOutputStream(targetFile);
                outStream.write(buffer);

                // Initializes new scan on created zip file
                scan(targetFile);
                return;
            }

            // Checks if zip file
            if (entryList.stream().anyMatch(entry -> entry.getName().startsWith("content/") && entry.getName().endsWith(".xml"))) {
                // Gets relevant Files
                List<ZipEntry> files = entryList.stream().filter(entry -> entry.getName().startsWith("content/") && entry.getName().endsWith(".xml")).collect(Collectors.toList());

                // Starts reading files
                run(files, zipFile);
            }
        } catch (IOException exception) {
            exception.printStackTrace();
        }
    }

    /**
     * Reads all Files in files argument, creates question objects and writes output to file.
     *
     * @param files   List of files to read
     * @param zipFile Zipfile object
     */
    public void run(List<ZipEntry> files, ZipFile zipFile) {
        try {
            // Creates List of Questions
            ArrayList<Question> questions = new ArrayList<>();

            // Loop through files
            for (ZipEntry entry : files) {
                System.out.println("Reading File: " + zipFile.getName() + "/" + entry.getName());

                // Creating new question
                Question question = new Question();

                // Getting xml file as dom document
                Document doc = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(zipFile.getInputStream(entry));

                // Normalizes Document
                doc.normalize();

                // Gets type of question (single,multiple)
                String type = ((Element) doc.getDocumentElement().getElementsByTagName("imsqti:responseDeclaration")
                        .item(0)).getAttribute("cardinality");

                // Switches through types
                switch (type) {
                    case "single" -> {
                        // Gets all elements which represents questions
                        NodeList elements = ((Element) doc.getDocumentElement().getElementsByTagName("imsqti:itemBody").item(0))
                                .getElementsByTagName("imsqti:choiceInteraction");

                        // Checks if there is more than one question in one file
                        if (elements.getLength() > 1) {
                            // Exports questions to extra file because of categories

                            // Creates new List of questions
                            ArrayList<Question> questions1 = new ArrayList<>();

                            // Loops through questions
                            for (int i = 0; i < elements.getLength(); i++) {
                                // Gets question element
                                Element element = (Element) elements.item(i);

                                // Gets name of question
                                question.setName(element.getAttribute("responseIdentifier"));

                                // Gets actual question
                                question.setQuestion(((Element) element.getElementsByTagName("imsqti:prompt").item(0))
                                        .getElementsByTagName("imsqti:span").item(1).getTextContent());

                                // Sets type to single
                                question.setType("2");

                                // Gets all answers
                                NodeList answers = element.getElementsByTagName("imsqti:simpleChoice");

                                // Loops through answers
                                for (int j = 0; j < answers.getLength(); j++) {
                                    Node answer = answers.item(j);

                                    // Checks if answer is correct
                                    if (((Element) answer).getAttribute("identifier").equals(((Element) ((Element) doc.getDocumentElement()
                                            .getElementsByTagName("imsqti:responseDeclaration").item(i))
                                            .getElementsByTagName("imsqti:correctResponse").item(0))
                                            .getElementsByTagName("imsqti:value").item(0).getTextContent())) {
                                        // Sets correct answer
                                        question.setSolution(answer.getTextContent());
                                    }

                                    // Adds answer to question
                                    question.addAnswer(answer.getTextContent());
                                }
                                // Adds question to extra list of questions
                                questions1.add(question);

                                // Resets question
                                question = new Question();
                            }

                            // Get file to write to
                            File outfile = new File(zipFile.getName() + doc.getDocumentElement().getAttribute("identifier") + "-output.xml");

                            // Write questions to file
                            Files.writeString(outfile.toPath(), getOutput(questions1, doc.getDocumentElement().getAttribute("title")));
                        } else {
                            // Gets question element
                            Element element = (Element) elements.item(0);

                            // Gets name of question
                            question.setName(doc.getDocumentElement().getAttribute("title"));

                            // Gets actual question
                            question.setQuestion(((Element) element.getElementsByTagName("imsqti:prompt").item(0))
                                    .getElementsByTagName("imsqti:span").item(1).getTextContent());

                            // Sets type to single
                            question.setType("2");

                            // Gets answers
                            NodeList nList = element.getElementsByTagName("imsqti:simpleChoice");

                            // Loops through answers
                            for (int j = 0; j < nList.getLength(); j++) {
                                Node answer = nList.item(j);

                                // Checks if answer is correct
                                if (((Element) answer).getAttribute("identifier").equals(((Element) ((Element) doc.getDocumentElement()
                                        .getElementsByTagName("imsqti:responseDeclaration").item(0))
                                        .getElementsByTagName("imsqti:correctResponse").item(0))
                                        .getElementsByTagName("imsqti:value").item(0).getTextContent())) {
                                    // Sets correct answer
                                    question.setSolution(answer.getTextContent());
                                }

                                // Adds answer to question
                                question.addAnswer(answer.getTextContent());
                            }
                            // Adds question to list of questions
                            questions.add(question);
                        }
                    }
                    case "multiple" -> {
                        // Gets question element
                        Element element = ((Element) ((Element) doc.getDocumentElement()
                                .getElementsByTagName("imsqti:itemBody").item(0))
                                .getElementsByTagName("imsqti:matchInteraction").item(0));


                        // Gets name of question
                        question.setName(doc.getDocumentElement().getAttribute("title"));

                        // Gets actual question
                        question.setQuestion(((Element) element.getElementsByTagName("imsqti:prompt").item(0))
                                .getElementsByTagName("imsqti:span").item(1).getTextContent());

                        // Sets type to kprim
                        question.setType("0");

                        // Gets solution data
                        NodeList mappings = ((Element) ((Element) doc.getDocumentElement()
                                .getElementsByTagName("imsqti:responseDeclaration").item(0))
                                .getElementsByTagName("imsqti:correctResponse").item(0))
                                .getElementsByTagName("imsqti:value");

                        // Creates map
                        HashMap<String, String> mappingmap = new HashMap<>(); // id, 0/1

                        // Loops through data
                        for (int i = 0; i < mappings.getLength(); i++) {
                            Node node = mappings.item(i);

                            // Puts data to map
                            mappingmap.put(node.getTextContent().split(" ")[0], (node.getTextContent().split(" ")[1].equals("falsch")) ? "0" : "1");
                        }

                        // Gets answers
                        NodeList nList = ((Element) element.getElementsByTagName("imsqti:simpleMatchSet").item(0)).getElementsByTagName("imsqti:simpleAssociableChoice");

                        // Loops through answers
                        for (int i = 0; i < nList.getLength(); i++) {
                            Node answer = nList.item(i);

                            // Sets Solution
                            question.setSolution(((question.getSolution() == null) ? "" : question.getSolution()) + mappingmap.get(((Element) answer).getAttribute("identifier")) + " ");

                            // Adds answer to question
                            question.addAnswer(answer.getTextContent());
                        }
                        // Adds question to list of questions
                        questions.add(question);
                    }
                }
            }

            // Checks if questions got added
            // In case there only were special ones which were exported to extra file
            if (questions.size() != 0) {
                // Get file to write to
                File outfile = new File(zipFile.getName() + "-output.xml");

                // Write questions to file
                Files.writeString(outfile.toPath(), getOutput(questions, "Prüfungsfragen"));
            }
            System.out.println();
        } catch (IOException e) {
            e.printStackTrace();
        } catch (ParserConfigurationException e) {
            e.printStackTrace();
        } catch (SAXException e) {
            e.printStackTrace();
        }
    }


    /**
     * Builds the output using question objects.
     *
     * @param questions List of questions
     * @param category  Name of category
     * @return String containing questions as moodle xml
     */
    public String getOutput(List<Question> questions, String category) {
        // Creates Stringbuilder
        StringBuilder sb = new StringBuilder();
        // Appends start of File
        sb.append("<quiz>");

        // Appends category
        sb.append("""
                <question type="category">
                    <category>
                        <text>$course$/top</text>
                    </category>
                </question>
                <question type="category">
                    <category>
                        <text>$course$/top/%s</text>
                    </category>
                </question>""".formatted(category));

        // Loops through questions
        for (Question question : questions) {
            // Checks if question is single
            if (question.getType().equals("2")) {
                // Appends Question Header
                sb.append("<question type=\"multichoice\">\n");

                // Appends name of question
                sb.append("<name><text>").append(question.getName()).append("</text></name>").append("\n");

                // Appends question
                sb.append("<questiontext format=\"html\"><text><![CDATA[").append(
                        question.getQuestion()
                                .replaceAll("<neg>", "<strong>")
                                .replaceAll("</neg>", "</strong>")
                ).append("]]></text></questiontext>").append("\n");

                // Appends stuff
                sb.append("<defaultgrade>1.0000000</defaultgrade>\n");
                sb.append("<penalty>0.3333333</penalty>\n");
                sb.append("<hidden>0</hidden>\n");
                sb.append("<single>true</single>\n");
                sb.append("<shuffleanswers>true</shuffleanswers>\n");
                sb.append("<answernumbering>none</answernumbering>\n");
                sb.append("<correctfeedback format=\"html\">\n<text>Die Antwort ist richtig.</text>\n</correctfeedback>\n");
                sb.append("<partiallycorrectfeedback format=\"html\">\n<text>Die Antwort ist teilweise richtig.</text>\n</partiallycorrectfeedback>\n");
                sb.append("<incorrectfeedback format=\"html\">\n<text>Die Antwort ist falsch.</text>\n</incorrectfeedback>\n");
                sb.append("<shownumcorrect/>\n");

                // Loops through answers
                for (String answer : question.getAnswers()) {
                    // Checks if answer ist correct
                    if (answer.equals(question.getSolution())) {
                        sb.append("<answer fraction=\"100\" format=\"html\">\n");
                    } else {
                        sb.append("<answer fraction=\"0\" format=\"html\">\n");
                    }

                    // Appends answer
                    sb.append("<text><![CDATA[").append(answer).append("]]></text>\n");
                    sb.append("</answer>\n");
                }
                sb.append("</question>\n\n");
            } else if (question.getType().equals("0")) {
                // Appends Question Header
                sb.append("<question type=\"kprime\">\n");

                // Appends name of question
                sb.append("<name><text>").append(question.getName()).append("</text></name>").append("\n");

                // Appends question
                sb.append("<questiontext format=\"html\"><text><![CDATA[").append(
                        question.getQuestion()
                                .replaceAll("<neg>", "<strong>")
                                .replaceAll("</neg>", "</strong>"))
                        .append("]]></text></questiontext>").append("\n");

                // Appends stuff
                sb.append("<defaultgrade>2.0000000</defaultgrade>\n");
                sb.append("<penalty>0.3333333</penalty>\n");
                sb.append("<hidden>0</hidden>\n");
                sb.append("<scoringmethod><text>kprime</text></scoringmethod>\n");
                sb.append("<shuffleanswers>true</shuffleanswers>\n");
                sb.append("<numberofrows>4</numberofrows>\n");
                sb.append("<numberofcolumns>2</numberofcolumns>\n");

                // Loops through answers
                for (String answer : question.getAnswers()) {
                    // Appends index of answer
                    sb.append("<row number=\"" + (question.getAnswers().indexOf(answer) + 1) + "\">\n");

                    sb.append("<optiontext format=\"html\">\n");

                    // Appends Answer
                    sb.append("<text><![CDATA[" + answer + "]]></text>\n");

                    sb.append("</optiontext>\n");
                    sb.append("<feedbacktext format=\"html\"><text></text></feedbacktext>\n");
                    sb.append("</row>\n");
                }

                // Appends stuff
                sb.append("<column number=\"1\">\n<responsetext format=\"moodle_auto_format\">\n<text>Richtig</text>\n</responsetext>\n" +
                        "</column>\n<column number=\"2\">\n<responsetext format=\"moodle_auto_format\">\n<text>Falsch</text>\n</responsetext>\n</column>\n");

                String[] split = question.getSolution().split(" ");
                for (int i = 0; i < split.length; i++) {
                    String sol = split[i];
                    // Appends weight
                    sb.append("<weight rownumber=\"" + (i + 1) + "\" columnnumber=\"1\">\n<value>\n" + ((sol.equals("1")) ? "1.000" : "0.000") + "\n</value>\n</weight>\n");
                    sb.append("<weight rownumber=\"" + (i + 1) + "\" columnnumber=\"2\">\n<value>\n" + ((sol.equals("0")) ? "1.000" : "0.000") + "\n</value>\n</weight>\n");
                }
                sb.append("</question>\n\n");
            }
        }
        // Appends end of file
        sb.append("</quiz>");

        // Returns output
        return sb.toString();
    }

    public class Question {
        private String name; // Name of Question
        private String question; // Text of Question
        private ArrayList<String> answers; // Answers of Question
        private String type; // 0 = kprim, 2 = single
        private String solution; // Solution of Question

        public Question() {
            this.answers = new ArrayList<>();
        }

        public String getQuestion() {
            return question;
        }

        public void setQuestion(String question) {
            this.question = question;
        }

        public ArrayList<String> getAnswers() {
            return answers;
        }

        public void addAnswer(String answer) {
            this.answers.add(answer);
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public String getSolution() {
            return solution;
        }

        public void setSolution(String solution) {
            this.solution = solution;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }
    }

}
