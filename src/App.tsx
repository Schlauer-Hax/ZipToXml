import logo from './logo.svg';
import './App.css';
import React, {useCallback, useState} from 'react'
import {useDropzone} from 'react-dropzone'
import readFiles from './ZipReader'
import {Button} from "@material-ui/core";

function App() {
    const onDrop = useCallback(acceptedFiles => {
        // Do something with the files
        console.log(acceptedFiles)
        readFiles(acceptedFiles, setData)
    }, [])
    const [data, setData] = useState([])
    const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop})

    return (
        <div className="App">
            <header className="App-header">
                <img src={logo} className="App-logo" alt="logo"/>
                <div {...getRootProps()}>
                    <input {...getInputProps()} />
                    {
                        isDragActive ?
                            <p>Drop the files here ...</p> :
                            <p>Drag 'n' drop some files here, or click to select files</p>
                    }
                </div>
                <Button
                    variant='contained'
                    color='primary'
                    disabled={Object.entries(data).length === 0}
                    onClick={
                        () => {
                            Object.entries(data).map((key: any) =>
                                `<quiz><question type="category">
                                    <category>
                                        <text>$course$/top</text>
                                    </category>
                                </question>
                                <question type="category">
                                    <category>
                                        <text>$course$/top/${key[0]}</text>
                                    </category>
                                </question>${key[1].join('')}</quiz>
                                `).forEach((text: string, index: number) => {

                                var xmlDoc = new DOMParser().parseFromString(text, 'application/xml');
                                var xsltDoc = new DOMParser().parseFromString([
                                    // describes how we want to modify the XML - indent everything
                                    '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">',
                                    '  <xsl:strip-space elements="*"/>',
                                    '  <xsl:template match="para[content-style][not(text())]">', // change to just text() to strip space in text nodes
                                    '    <xsl:value-of select="normalize-space(.)"/>',
                                    '  </xsl:template>',
                                    '  <xsl:template match="node()|@*">',
                                    '    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>',
                                    '  </xsl:template>',
                                    '  <xsl:output indent="yes"/>',
                                    '</xsl:stylesheet>',
                                ].join('\n'), 'application/xml');

                                var xsltProcessor = new XSLTProcessor();
                                xsltProcessor.importStylesheet(xsltDoc);
                                var resultDoc = xsltProcessor.transformToDocument(xmlDoc);
                                var resultXml = new XMLSerializer().serializeToString(resultDoc);


                                const element = document.createElement("a");
                                const file = new Blob([resultXml], {type: 'text/plain'});
                                element.href = URL.createObjectURL(file);
                                element.download = index + ".xml";
                                document.body.appendChild(element); // Required for this to work in FireFox
                                element.click()
                            })


                        }
                    }
                >Download</Button>
            </header>
        </div>
    );
}

export default App;
